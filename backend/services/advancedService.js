/**
 * ULTRON Advanced Service
 * Safe, additive capabilities for diagnostics, skills, workspace access,
 * web research dispatch and sequential task execution.
 *
 * No arbitrary shell execution is exposed through this module.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const { searchWeb } = require("./webService");
const { saveMemory, getMemories } = require("../memory/memoryService");
const planner = require("../agents/planner");
const orchestrator = require("../agents/orchestrator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

const SKILLS = [
    { id: "ai-chat", name: "AI Chat", status: "ready", description: "Local/provider-backed conversation." },
    { id: "memory", name: "Persistent Memory", status: "ready", description: "Save, read and clear ULTRON memories." },
    { id: "web-research", name: "Web Research", status: "ready", description: "Search and summarize current web information." },
    { id: "desktop", name: "Desktop Control", status: "ready", description: "Trusted Windows app launching and keyboard actions." },
    { id: "system-monitor", name: "System Monitor", status: "ready", description: "CPU, RAM, battery, network and uptime telemetry." },
    { id: "planner", name: "Task Planner", status: "ready", description: "Sequential planning for supported desktop actions." },
    { id: "workspace", name: "Workspace", status: "ready", description: "Safe project/workspace inspection." },
    { id: "diagnostics", name: "Self Diagnostics", status: "ready", description: "Local health and dependency checks." },
    { id: "voice", name: "Voice", status: "browser", description: "Browser speech recognition and speech synthesis." },
    { id: "browser-launch", name: "Browser Launch", status: "ready", description: "Open approved web destinations." }
];

function safeRelativePath(input) {
    const raw = String(input || "").trim();
    if (!raw) return PROJECT_ROOT;
    const candidate = path.resolve(PROJECT_ROOT, raw);
    if (candidate === PROJECT_ROOT || candidate.startsWith(PROJECT_ROOT + path.sep)) {
        return candidate;
    }
    return null;
}

function workspaceInfo() {
    const packagePath = path.join(PROJECT_ROOT, "package.json");
    let packageData = {};
    try {
        packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    } catch {}
    return {
        root: PROJECT_ROOT,
        platform: process.platform,
        node: process.version,
        app: packageData.name || "ultron",
        version: packageData.version || "unknown",
        memoryCount: getMemories().length,
        pid: process.pid,
        uptimeSeconds: Math.floor(process.uptime())
    };
}

function listWorkspace(relativePath = "") {
    const target = safeRelativePath(relativePath);
    if (!target) throw new Error("Workspace path is outside ULTRON.");

    const stat = fs.statSync(target);
    if (!stat.isDirectory()) throw new Error("Workspace target is not a directory.");

    const entries = fs.readdirSync(target, { withFileTypes: true });
    return entries
        .filter(entry => !["node_modules", ".git"].includes(entry.name))
        .slice(0, 250)
        .map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file"
        }));
}

async function diagnostics() {
    const checks = [];

    const checkFile = (name, relative) => {
        const exists = Boolean(safeRelativePath(relative) && fs.existsSync(safeRelativePath(relative)));
        checks.push({ name, status: exists ? "pass" : "fail", detail: relative });
    };

    checkFile("package.json", "package.json");
    checkFile("backend", "backend");
    checkFile("frontend", "frontend");
    checkFile("AI service", "backend/services/aiService.js");
    checkFile("Web service", "backend/services/webService.js");
    checkFile("Research service", "backend/services/researchService.js");
    checkFile("Planner", "backend/agents/planner.js");

    let ollama = { status: "unknown", detail: "not checked" };
    try {
        const url = process.env.OLLAMA_URL || "http://localhost:11434/api/tags";
        const base = new URL(url);
        base.pathname = "/api/tags";
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(base.href, { signal: controller.signal });
        clearTimeout(timer);
        ollama = { status: response.ok ? "pass" : "warn", detail: `HTTP ${response.status}` };
    } catch (error) {
        ollama = { status: "warn", detail: "Ollama not reachable from this process." };
    }
    checks.push({ name: "Ollama", ...ollama });

    return {
        status: checks.every(x => x.status !== "fail") ? "healthy" : "degraded",
        generatedAt: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        pid: process.pid,
        checks
    };
}

async function executeTask(task) {
    if (!task || typeof task !== "object") throw new Error("Task object required.");

    const steps = Array.isArray(task.steps)
        ? task.steps
        : typeof task.command === "string"
            ? [task.command]
            : [];

    if (!steps.length) throw new Error("Task needs a command or steps.");
    if (steps.length > 5) throw new Error("Maximum 5 sequential steps.");

    const commandResults = [];
    for (const command of steps) {
        if (typeof command !== "string" || !command.trim()) {
            throw new Error("Every task step must be a non-empty command.");
        }
        const plan = planner.planTask(command.trim());
        if (!plan || plan.success !== true) {
            commandResults.push({ command, status: "rejected", reason: plan?.reason || "no_plan" });
            continue;
        }
        const result = await orchestrator.executePlan(plan, command.trim());
        commandResults.push({ command, ...result });
        if (result.status !== "completed") break;
    }

    return {
        status: commandResults.every(x => x.status === "completed") ? "success" : "partial",
        steps: commandResults
    };
}

async function research(query) {
    const q = String(query || "").trim();
    if (!q) throw new Error("Research query required.");
    const result = await searchWeb(q);
    return {
        status: result?.status || "error",
        query: q,
        results: Array.isArray(result?.results) ? result.results.slice(0, 10) : []
    };
}

module.exports = {
    SKILLS,
    workspaceInfo,
    listWorkspace,
    diagnostics,
    executeTask,
    research
};
