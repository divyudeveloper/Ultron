const systemAgent = require("../agents/systemAgent");
const agentRegistry = require("../agents/agentRegistry");
const planner = require("../agents/planner");
const orchestrator = require("../agents/orchestrator");
const {
    getSystemInformation
} = require("../utils/systemMonitor");

const {
    searchWeb,
    webRequest
} = require("../services/webService");

const {
    summarizeWebResearch
} = require("../services/researchService");


const { exec, spawn } = require("child_process");

const {
    executeDesktopAction,
    verifyProcessRunning,
    executeAndVerifyApp
} = require("../agents/desktopAgent");

const {
    SKILLS,
    workspaceInfo,
    listWorkspace,
    diagnostics
} = require("../services/advancedService");



const {
    getMemories,
    saveMemory,
    searchMemories,
    updateMemoryByQuery,
    deleteMemoryByQuery,
    clearMemories
} = require("../memory/memoryService");


/* =========================================================
   ULTRON COMMAND SERVICE
   Centralized command router
========================================================= */


/* =========================================================
   COMMON HELPERS
========================================================= */

function cleanText(command) {

    return String(command || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}


function removeAssistantPrefix(text) {

    return text
        .replace(
            /^(?:ultron|hey ultron|hello ultron)\s*,?\s*/i,
            ""
        )
        .replace(
            /^(?:bhai|bro)\s*,?\s*/i,
            ""
        )
        .trim();
}


function openUrl(url, intent, message) {
    return new Promise((resolve) => {
        let parsedUrl;

        try {
            parsedUrl = new URL(String(url || "").trim());
        } catch {
            resolve({
                status: "error",
                intent,
                message: `${message} Open nahi ho paaya.`
            });
            return;
        }

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            resolve({
                status: "error",
                intent,
                message: `${message} Sirf HTTP/HTTPS URLs allowed hain.`
            });
            return;
        }

        const { spawn } = require("child_process");

        const child = spawn(
            "explorer.exe",
            [parsedUrl.toString()],
            {
                shell: false,
                windowsVerbatimArguments: false,
                detached: true,
                stdio: "ignore"
            }
        );

        child.unref();

        child.on("error", (error) => {
            console.error(`[ULTRON] ${intent} error:`, error);

            resolve({
                status: "error",
                intent,
                message: `${message} Open nahi ho paaya.`
            });
        });

        // explorer.exe ka exit code browser launch ka reliable
        // verification nahi hai. Spawn successful hone par command
        // dispatch ho chuka maana jata hai.
        resolve({
            status: "success",
            intent,
            verification: "dispatched",
            message
        });
    });
}
/* =========================================================
   OPEN COMMAND MATCHER
========================================================= */

function matchesOpenCommand(text, target) {

    const normalized =
        removeAssistantPrefix(text);

    const targetPattern =
        `(?:${target})`;

    const actionPattern =
        "(?:open|launch|start|run|khol|kholo|kholna|khol\\s+do|chalu\\s+kar|chalu\\s+karo|chalu\\s+kar\\s+do|open\\s+kar|open\\s+karo|open\\s+kar\\s+do|launch\\s+kar|launch\\s+karo)";

    const ending =
        "\\s*(?:please|plz|bro|bhai|do|de|karo|karna)?\\s*[.!?]*$";


    const actionFirst =
        new RegExp(
            `^(?:please\\s+)?${actionPattern}\\s+(?:the\\s+)?${targetPattern}${ending}`,
            "i"
        );


    const targetFirst =
        new RegExp(
            `^(?:please\\s+)?(?:the\\s+)?${targetPattern}\\s+${actionPattern}${ending}`,
            "i"
        );


    return (
        actionFirst.test(normalized) ||
        targetFirst.test(normalized)
    );
}


/* =========================================================
   SEARCH COMMAND MATCHER
========================================================= */

function getSearchQuery(text) {

    const normalized =
        removeAssistantPrefix(text);

    return normalized
        .replace(
            /^(?:web search|web search karo|web par search|internet search|search web|search for|google search|google|search)\s*/i,
            ""
        )
        .trim();
}


/* =========================================================
   INTENT DETECTION
========================================================= */

function detectIntent(command) {

    const rawText =
        cleanText(command);
    if (!rawText) {
        return "empty";
    }


    // Handle greetings before removing the assistant prefix.
    if (/^(?:hi|hello|hey|hii|helo)(?:\s+ultron)?$/i.test(rawText)) {
        return "greeting";
    }

    const text =
        removeAssistantPrefix(rawText);


    
    if (/^(?:press tab|tab)$/i.test(text)) {
    return "keyboard_tab";
}

if (/^(?:press enter|enter)$/i.test(text)) {
    return "keyboard_enter";
}

if (/^(?:select all|select everything|ctrl\s+a|control\s+a)$/i.test(text)) {
        return "keyboard_ctrl_a";
    }

    if (/^(?:copy|copy this|ctrl\s+c|control\s+c)$/i.test(text)) {
        return "keyboard_ctrl_c";
    }

    if (/^(?:paste|paste this|ctrl\s+v|control\s+v)$/i.test(text)) {
        return "keyboard_ctrl_v";
    }

    if (/^(?:cut|cut this|ctrl\s+x|control\s+x)$/i.test(text)) {
        return "keyboard_ctrl_x";
    }

    if (/^(?:save|save this|ctrl\s+s|control\s+s)$/i.test(text)) {
        return "keyboard_ctrl_s";
    }

    if (/^(?:undo|undo that|ctrl\s+z|control\s+z)$/i.test(text)) {
        return "keyboard_ctrl_z";
    }

    if (/^(?:redo|redo that|ctrl\s+y|control\s+y)$/i.test(text)) {
        return "keyboard_ctrl_y";
    }
/* =====================================================
       GREETING
    ===================================================== */

    if (
        /^(hi|hello|hey|hii|helo)\b/i.test(text)
    ) {
        return "greeting";
    }


    /* =====================================================
       HELP
    ===================================================== */

    if (
        text === "help" ||
        text.includes("help me") ||
        text.includes("madad karo") ||
        text.includes("meri help")
    ) {
        return "help";
    }


    /* =====================================================
       SYSTEM STATUS
    ===================================================== */

    if (
        /^(?:system|laptop|pc|computer)\s+(?:status|health|check)/i.test(text) ||
        /^(?:system|laptop|pc|computer)\s+(?:ka|ki)\s+(?:status|health)\s+(?:bata|batao|dikhao)/i.test(text) ||
        /^(?:system|laptop|pc|computer)\s+(?:check|health)\s+(?:karo|batao|bata)/i.test(text) ||
        /^(?:system|laptop|pc|computer)\s+ka\s+status\s+(?:bata|batao)/i.test(text) ||
        /^(?:system|laptop|pc|computer)\s+kaisa\s+hai/i.test(text) ||
        /^mera\s+laptop\s+kaisa\s+hai/i.test(text) ||
        /^(?:status|health)\s+(?:batao|dikhao)/i.test(text)
    ) {
        return "system_status";
    }


    /* =====================================================
       NETWORK
    ===================================================== */

    if (
        /^(?:internet|network|wifi)\s+(?:status|check|connected|online)/i.test(text) ||
        /^(?:internet|wifi)\s+chal\s+raha\s+hai/i.test(text)
    ) {
        return "network_status";
    }


    /* =====================================================
       BATTERY
    ===================================================== */

    if (
        (/^(?:battery\b|meri\s+battery\b)/i.test(text)) &&
        (
            text.includes("kitni") ||
            text.includes("bata") ||
            text.includes("dikhao") ||
            text.includes("status") ||
            text.includes("check") ||
            text.includes("percentage")
        )
    ) {
        return "battery_status";
    }


    /* =====================================================
       UPTIME
    ===================================================== */

    if (
        /^uptime\b/i.test(text) ||
        /laptop\s+kab\s+se\s+(?:on|chalu)\s+hai/i.test(text) ||
        /system\s+kab\s+se\s+(?:on|chalu)\s+hai/i.test(text)
    ) {
        return "uptime";
    }


    /* =====================================================
       MEMORY SAVE
    ===================================================== */

    if (
        text.startsWith("remember ") ||
        text.startsWith("save memory ") ||
        text.startsWith("yaad rakhna ") ||
        text.startsWith("yaad rakh ")
    ) {
        return "memory_save";
    }


    /* =====================================================
       MEMORY SEARCH
    ===================================================== */

    if (
        text.startsWith("search memory ") ||
        text.startsWith("find memory ") ||
        text.startsWith("memory search ") ||
        text.startsWith("memory mein search karo ")
    ) {
        return "memory_search";
    }


    /* =====================================================
       MEMORY UPDATE
    ===================================================== */

    if (
        text.startsWith("update memory ") ||
        text.startsWith("change memory ")
    ) {
        return "memory_update";
    }


    /* =====================================================
       MEMORY DELETE
    ===================================================== */

    if (
        text.startsWith("delete memory ") ||
        text.startsWith("remove memory ") ||
        text.startsWith("forget memory ")
    ) {
        return "memory_delete";
    }


    /* =====================================================
       MEMORY CLEAR
    ===================================================== */

    if (
        text === "clear memory" ||
        text === "clear memories" ||
        text === "forget everything" ||
        text === "sab memory delete karo"
    ) {
        return "memory_clear";
    }


    /* =====================================================
       MEMORY READ
    ===================================================== */

    if (
        text === "memory" ||
        text.includes("memory dikhao") ||
        text.includes("meri memory") ||
        text.includes("what do you remember")
    ) {
        return "memory";
    }


    /* =====================================================
       ARITHMETIC CALCULATOR
    ===================================================== */

    if (/^(?:calculate|calc)\s+[-+*/%().0-9\s]+$/i.test(text)) {
        return "calculate";
    }


    if (
        /^(?:open|launch|start|run)\s+(?:notepad|note\s+pad|calculator|calc|chrome|vscode|vs\s*code|visual\s+studio\s+code)\s+(?:and|then)\s+type\s+.+/i.test(text) ||
        /^(?:open|launch|start|run)\s+(?:notepad|note\s+pad|calculator|calc|chrome|vscode|vs\s*code|visual\s+studio\s+code|youtube)\s+(?:and|then)\s+(?:open|launch|start|run)?\s*(?:notepad|note\s+pad|calculator|calc|chrome|vscode|vs\s*code|visual\s+studio\s+code|youtube)$/i.test(text)
    ) {
        return "desktop_multi_action";
    }
    if (/^type\s+.+/i.test(rawText.trim())) {
        return "type_text";
    }


    /* =====================================================
       ADVANCED CAPABILITIES
    ===================================================== */

    if (/^(?:advanced\s+)?(?:diagnostics?|self\s+diagnostics?)(?:\s+(?:check|status|run|dikhao|batao|bata|karo))?$/i.test(text)) {
        return "advanced_diagnostics";
    }

    if (/^(?:advanced\s+)?skills?(?:\s+(?:check|status|dikhao|batao|bata|show))?$/i.test(text)) {
        return "advanced_skills";
    }

    if (/^(?:advanced\s+)?workspace(?:\s+(?:check|status|dikhao|batao|bata|show|list))?$/i.test(text)) {
        return "advanced_workspace";
    }


    /* =====================================================
       WEBSITE / APP OPENING
       IMPORTANT: BEFORE WEB SEARCH
    ===================================================== */

    if (
        matchesOpenCommand(
            rawText,
            "(?:calculator|calc|calcutre|calcultor|calculater)"
        )
    ) {
        return "open_calculator";
    }


    if (
        matchesOpenCommand(
            rawText,
            "(?:notepad|note\\s+pad)"
        )
    ) {
        return "open_notepad";
    }


    if (
        matchesOpenCommand(
            rawText,
            "chrome"
        )
    ) {
        return "open_chrome";
    }


    if (
        matchesOpenCommand(
            rawText,
            "(?:file\\s+explorer|explorer|folder|folders)"
        )
    ) {
        return "open_explorer";
    }


    if (
        matchesOpenCommand(
            rawText,
            "youtube"
        ) ||
        /^(?:youtube)\s+(?:chalao|kholo|khol|open\s+karo)$/i.test(text)
    ) {
        return "open_youtube";
    }


    if (
        matchesOpenCommand(
            rawText,
            "(?:vscode|vs\\s*code|visual\\s+studio\\s+code)"
        )
    ) {
        return "open_vscode";
    }


    if (
        matchesOpenCommand(
            rawText,
            "google"
        )
    ) {
        return "open_google";
    }


    /* =====================================================
       WHATSAPP
    ===================================================== */

    if (
        matchesOpenCommand(
            rawText,
            "(?:whatsapp|whats\\s*app)"
        )
    ) {
        return "open_whatsapp";
    }


    /* =====================================================
       INSTAGRAM
    ===================================================== */

    if (
        matchesOpenCommand(
            rawText,
            "(?:instagram|insta)"
        )
    ) {
        return "open_instagram";
    }


    /* =====================================================
       GMAIL
    ===================================================== */

    if (
        matchesOpenCommand(
            rawText,
            "(?:gmail|mail|email)"
        )
    ) {
        return "open_gmail";
    }


    /* =====================================================
       WEBSITE COMMANDS
    ===================================================== */

    if (
        /^open website\s+/i.test(text) ||
        /^open site\s+/i.test(text)
    ) {
        return "open_website";
    }


    /* =====================================================
       YOUTUBE SEARCH
    ===================================================== */

    if (
        /^youtube\s+(?:search|par\s+search|search\s+for)\s+/i.test(text)
    ) {
        return "youtube_search";
    }


    /* =====================================================
       GOOGLE SEARCH
    ===================================================== */

    if (
        text.startsWith("web search ") ||
        text.startsWith("web search karo ") ||
        text.startsWith("web par search ") ||
        text.startsWith("internet search ") ||
        text.startsWith("search web ") ||
        text.startsWith("search for ") ||
        text.startsWith("google search ") ||
        text.startsWith("google ") ||
        text.startsWith("search ")
    ) {
        return "web_search";
    }


    /* =====================================================
       WEB RESEARCH
    ===================================================== */

    if (
        text.startsWith("research ") ||
        text.startsWith("deep research ") ||
        text.startsWith("research about ") ||
        text.startsWith("research on ") ||

        /\b(latest|current|recent|today|this week|this month|as of)\b/i.test(text) ||

        /\b(official website|official source|official sources|according to)\b/i.test(text) ||

        /\b(latest news|recent news|live update|breaking news)\b/i.test(text)
    ) {
        return "web_research";
    }


    /* =====================================================
       WHATSAPP MESSAGE COMMAND
       Compose only - send requires confirmation
    ===================================================== */

    if (
        /^(?:whatsapp|whats\s*app)\s+(?:message|msg|text)\s+/i.test(text) ||
        /^message\s+/i.test(text) &&
        /\bon\s+whatsapp\b/i.test(text)
    ) {
        return "whatsapp_message";
    }


    /* =====================================================
       GMAIL COMPOSE
    ===================================================== */

    if (
        /^gmail\s+(?:compose|mail|email)\s+/i.test(text) ||
        /^send\s+(?:an\s+)?email\s+/i.test(text)
    ) {
        return "gmail_compose";
    }


    /* =====================================================
       INSTAGRAM MESSAGE
       Compose only - send requires confirmation
    ===================================================== */

    if (
        /^(?:instagram|insta)\s+(?:message|msg|dm)\s+/i.test(text) ||
        /^dm\s+/i.test(text)
    ) {
        return "instagram_message";
    }


    /* =====================================================
       UNKNOWN
    ===================================================== */

    return "unknown";
}


/* =========================================================
   MEMORY HANDLERS
========================================================= */

function saveMemoryResponse(command) {

    const match =
        String(command || "").match(
            /^(?:remember|save memory|yaad rakhna|yaad rakh)\s+(.+)$/i
        );

    if (!match) {
        return {
            status: "error",
            intent: "memory_save",
            message:
                "Kya yaad rakhna hai?"
        };
    }

    const saved =
        saveMemory(
            "user",
            match[1]
        );

    if (saved.status === "existing") {
        return {
            status: "success",
            intent: "memory_save",
            message:
                "Ye memory already saved hai."
        };
    }

    return {
        status: "success",
        intent: "memory_save",
        message:
            "Done bro. Maine yaad rakh liya: " +
            saved.content
    };
}


function searchMemoryResponse(command) {

    const match =
        String(command || "").match(
            /^(?:search memory|find memory|memory search|memory mein search karo)\s+(.+)$/i
        );

    if (!match) {
        return {
            status: "error",
            intent: "memory_search",
            message:
                "Kis cheez ko memory mein search karna hai?"
        };
    }

    const results =
        searchMemories(
            match[1],
            10
        );

    if (!results.length) {
        return {
            status: "success",
            intent: "memory_search",
            message:
                "Mujhe memory mein '" +
                match[1] +
                "' nahi mila."
        };
    }

    const resultText =
        results
            .map(
                (memory, index) =>
                    `${index + 1}. ${memory.content}`
            )
            .join("\n");

    return {
        status: "success",
        intent: "memory_search",
        message:
            "Memory search results:\n" +
            resultText
    };
}


function updateMemoryResponse(command) {

    const match =
        String(command || "").match(
            /^(?:update memory|change memory)\s+(.+?)\s+(?:to|into)\s+(.+)$/i
        );

    if (!match) {
        return {
            status: "error",
            intent: "memory_update",
            message:
                "Example: update memory favorite language to Python."
        };
    }

    return updateMemoryByQuery(
        match[1],
        "user",
        match[2]
    );
}


function deleteMemoryResponse(command) {

    const match =
        String(command || "").match(
            /^(?:delete memory|remove memory|forget memory)\s+(.+)$/i
        );

    if (!match) {
        return {
            status: "error",
            intent: "memory_delete",
            message:
                "Example: delete memory favorite language."
        };
    }

    return deleteMemoryByQuery(
        match[1]
    );
}


function clearMemoryResponse() {

    return clearMemories();
}


/* =========================================================
   HELP
========================================================= */

function getHelpResponse() {

    return {
        status: "success",
        intent: "help",
        message:
            "ULTRON commands: system status, battery, network, uptime, memory, Calculator, Notepad, Chrome, File Explorer, YouTube, VS Code, Google, WhatsApp, Instagram, Gmail, website open, Google search, YouTube search aur web research."
    };
}


/* =========================================================
   SYSTEM
========================================================= */

async function getSystemStatusResponse() {

    const system =
        await getSystemInformation();

    const batteryText =
        system.battery &&
        system.battery.available
            ? String(system.battery.percent) + "%"
            : "unavailable";

    return {
        status: "success",
        intent: "system_status",
        message:
            "System online. CPU usage " +
            system.cpu.usage +
            "%, RAM usage " +
            system.memory.usage +
            "%, battery " +
            batteryText +
            "."
    };
}


/* =========================================================
   NETWORK
========================================================= */

async function getNetworkStatusResponse() {

    const system =
        await getSystemInformation();

    const online =
        system.network &&
        system.network.internet === true;

    const interfaceName =
        system.network &&
        system.network.interfaces &&
        system.network.interfaces.length
            ? system.network.interfaces[0].name
            : "Unknown";

    return {
        status: "success",
        intent: "network_status",
        message:
            online
                ? "Internet is online. Active interface: " +
                  interfaceName +
                  "."
                : "Internet connection appears to be offline."
    };
}


/* =========================================================
   BATTERY
========================================================= */

async function getBatteryStatusResponse() {

    const system =
        await getSystemInformation();

    if (
        !system.battery ||
        !system.battery.available
    ) {
        return {
            status: "success",
            intent: "battery_status",
            message:
                "Battery information is currently unavailable."
        };
    }

    return {
        status: "success",
        intent: "battery_status",
        message:
            system.battery.charging
                ? "Battery is at " +
                  system.battery.percent +
                  "% and currently charging."
                : "Battery is at " +
                  system.battery.percent +
                  "%."
    };
}


/* =========================================================
   UPTIME
========================================================= */

async function getUptimeStatusResponse() {

    const data =
        await getSystemInformation();

    const seconds =
        Math.floor(
            Number(data.uptime) || 0
        );

    const days =
        Math.floor(seconds / 86400);

    const hours =
        Math.floor(
            (seconds % 86400) / 3600
        );

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    return {
        status: "success",
        intent: "uptime",
        message:
            "System uptime is " +
            days +
            " days, " +
            hours +
            " hours and " +
            minutes +
            " minutes."
    };
}


/* =========================================================
   SAFE ARITHMETIC CALCULATOR
========================================================= */

function evaluateArithmeticExpression(expression) {
    const source = String(expression || "").trim();
    if (!source || source.length > 200) {
        throw new Error("Expression is empty or too long.");
    }

    const tokens = source.match(/(?:\d+(?:\.\d+)?|\.\d+|[()+\-*/%])/g);
    if (!tokens || tokens.join("") !== source.replace(/\s+/g, "")) {
        throw new Error("Only numbers and + - * / % ( ) are allowed.");
    }

    let index = 0;
    function parseExpression() {
        let value = parseTerm();
        while (tokens[index] === "+" || tokens[index] === "-") {
            const op = tokens[index++];
            const right = parseTerm();
            value = op === "+" ? value + right : value - right;
        }
        return value;
    }
    function parseTerm() {
        let value = parseFactor();
        while (["*", "/", "%"].includes(tokens[index])) {
            const op = tokens[index++];
            const right = parseFactor();
            if ((op === "/" || op === "%") && right === 0) {
                throw new Error("Division by zero is not allowed.");
            }
            if (op === "*") value *= right;
            else if (op === "/") value /= right;
            else value %= right;
        }
        return value;
    }
    function parseFactor() {
        if (tokens[index] === "+" || tokens[index] === "-") {
            const sign = tokens[index++] === "-" ? -1 : 1;
            return sign * parseFactor();
        }
        if (tokens[index] === "(") {
            index++;
            const value = parseExpression();
            if (tokens[index++] !== ")") throw new Error("Mismatched parentheses.");
            return value;
        }
        const token = tokens[index++];
        const value = Number(token);
        if (!Number.isFinite(value)) throw new Error("Invalid number.");
        return value;
    }

    const result = parseExpression();
    if (index !== tokens.length || !Number.isFinite(result)) {
        throw new Error("Invalid arithmetic expression.");
    }
    return result;
}

function calculateResponse(command) {
    const match = String(command || "").trim().match(/^(?:calculate|calc)\s+(.+)$/i);
    if (!match) {
        return { status: "error", intent: "calculate", message: "Example: calculate 25 * 4" };
    }
    try {
        const result = evaluateArithmeticExpression(match[1]);
        return { status: "success", intent: "calculate", expression: match[1].trim(), result, message: `Result: ${result}` };
    } catch (error) {
        return { status: "error", intent: "calculate", message: error.message };
    }
}


/* =========================================================
   DESKTOP APPS
========================================================= */

function openCalculator() {

    return executeAndVerifyApp(
        "start calc.exe",
        "open_calculator",
        "CalculatorApp.exe",
        "Calculator",
        "Calculator open kar diya.",
        "Calculator open nahi ho paaya."
    );
}


function openNotepad() {

    return executeAndVerifyApp(
        "start notepad.exe",
        "open_notepad",
        "notepad.exe",
        "Notepad",
        "Notepad open kar diya.",
        "Notepad open nahi ho paaya."
    );
}


function openChrome() {
    return executeAndVerifyApp(
        "start chrome",
        "open_chrome",
        "chrome.exe",
        "Chrome",
        "Chrome open kar diya.",
        "Chrome open nahi ho paaya."
    );
}


function openExplorer() {

    return new Promise((resolve) => {

        try {

            const explorer =
                spawn(
                    "explorer.exe",
                    ["C:\\"],
                    {
                        detached: true,
                        stdio: "ignore",
                        windowsHide: false
                    }
                );

            explorer.once(
                "error",
                (error) => {

                    console.error(
                        "[ULTRON] Explorer error:",
                        error
                    );

                    resolve({
                        status: "error",
                        intent: "open_explorer",
                        message:
                            "File Explorer open nahi ho paaya."
                    });
                }
            );

            explorer.unref();

            setImmediate(() => {

                resolve({
                    status: "success",
                    intent: "open_explorer",
                    message:
                        "File Explorer open kar diya."
                });
            });

        } catch (error) {

            console.error(
                "[ULTRON] Explorer error:",
                error
            );

            resolve({
                status: "error",
                intent: "open_explorer",
                message:
                    "File Explorer open nahi ho paaya."
            });
        }
    });
}


/* =========================================================
   WEBSITES
========================================================= */

function openYouTube() {

    return openUrl(
        "https://www.youtube.com",
        "open_youtube",
        "YouTube open kar diya."
    );
}


function openGoogle() {

    return openUrl(
        "https://www.google.com",
        "open_google",
        "Google open kar diya."
    );
}


function openWhatsApp() {

    return openUrl(
        "https://web.whatsapp.com",
        "open_whatsapp",
        "WhatsApp Web open kar diya."
    );
}


function openInstagram() {

    return openUrl(
        "https://www.instagram.com",
        "open_instagram",
        "Instagram open kar diya."
    );
}


function openGmail() {

    return openUrl(
        "https://mail.google.com",
        "open_gmail",
        "Gmail open kar diya."
    );
}


function openVSCode() {
    return executeAndVerifyApp(
        "start code",
        "open_vscode",
        "Code.exe",
        "VS Code",
        "VS Code open kar diya.",
        "VS Code open nahi ho paaya. Check karo ki 'code' command PATH mein available hai."
    );
}


/* =========================================================
   WEBSITE OPEN
========================================================= */

async function openWebsiteResponse(command) {

    const match =
        String(command || "").match(
            /^open\s+(?:website|site)\s+(.+)$/i
        );

    if (!match) {

        return {
            status: "error",
            intent: "open_website",
            message:
                "Example: open website github.com"
        };
    }

    let url =
        match[1].trim();

    if (
        !/^https?:\/\//i.test(url)
    ) {
        url =
            "https://" + url;
    }

    return openUrl(
        url,
        "open_website",
        "Website open kar diya."
    );
}


/* =========================================================
   YOUTUBE SEARCH
========================================================= */

async function youtubeSearchResponse(command) {

    const text =
        String(command || "")
            .trim();

    const match =
        text.match(
            /^(?:youtube)\s+(?:search|par\s+search|search\s+for)\s+(.+)$/i
        );

    if (!match) {

        return {
            status: "error",
            intent: "youtube_search",
            message:
                "Example: YouTube search JavaScript tutorial"
        };
    }

    const query =
        encodeURIComponent(
            match[1].trim()
        );

    return openUrl(
        `https://www.youtube.com/results?search_query=${query}`,
        "youtube_search",
        "YouTube par search kar diya."
    );
}


/* =========================================================
   WEB RESEARCH
========================================================= */

async function performWebResearch(command) {

    const query =
        String(command || "")
            .replace(/^deep research\s*/i, "")
            .replace(/^research about\s*/i, "")
            .replace(/^research on\s*/i, "")
            .replace(/^research\s*/i, "")
            .trim();

    if (!query) {

        return {
            status: "error",
            intent: "web_research",
            message:
                "Kis topic par research karni hai?"
        };
    }

    console.log(
        `[ULTRON RESEARCH] Searching: ${query}`
    );

    const searchResult =
        await searchWeb(query);

    if (
        !searchResult ||
        searchResult.status !== "success" ||
        !Array.isArray(searchResult.results) ||
        searchResult.results.length === 0
    ) {

        return {
            status: "error",
            intent: "web_research",
            query,
            message:
                "Research ke liye relevant web results nahi mile."
        };
    }

    const topResults =
        searchResult.results.slice(0, 5);

    const pages =
        await Promise.all(
            topResults.map(
                async (result) => {

                    try {

                        const cachedContent =
                            String(
                                result.readableContent || ""
                            ).trim();

                        if (cachedContent) {

                            return {
                                title:
                                    result.pageTitle ||
                                    result.title ||
                                    "",

                                url:
                                    result.url ||
                                    "",

                                snippet:
                                    result.snippet ||
                                    "",

                                publishedAt:
                                    result.publishedAt ||
                                    "",

                                modifiedAt:
                                    result.modifiedAt ||
                                    "",

                                content:
                                    cachedContent
                            };
                        }

                        const page =
                            await webRequest(
                                result.url
                            );

                        return {
                            title:
                                result.title ||
                                "",

                            url:
                                result.url ||
                                "",

                            snippet:
                                result.snippet ||
                                "",

                            publishedAt:
                                result.publishedAt ||
                                "",

                            modifiedAt:
                                result.modifiedAt ||
                                "",

                            content:
                                page &&
                                page.status === "success"
                                    ? page.readableContent ||
                                      page.content ||
                                      ""
                                    : ""
                        };

                    } catch (error) {

                        console.log(
                            `[ULTRON RESEARCH] Page read failed: ${result.url}`
                        );

                        return {
                            title:
                                result.title ||
                                "",

                            url:
                                result.url ||
                                "",

                            snippet:
                                result.snippet ||
                                "",

                            publishedAt:
                                result.publishedAt ||
                                "",

                            modifiedAt:
                                result.modifiedAt ||
                                "",

                            content: ""
                        };
                    }
                }
            )
        );


    const usablePages =
        pages.filter(
            page =>
                page.content &&
                page.content.trim().length > 0
        );


    if (!usablePages.length) {

        return {
            status: "error",
            intent: "web_research",
            query,
            message:
                "Web pages mil gaye, lekin readable content nahi mila."
        };
    }


    try {

        const summary =
            await summarizeWebResearch(
                query,
                usablePages
            );

        return {
            ...summary,
            intent: "web_research",
            query,
            researchReady: true,
            results: pages
        };

    } catch (error) {

        console.error(
            "[ULTRON RESEARCH AI ERROR]",
            error.message
        );

        return {
            status: "error",
            intent: "web_research",
            query,
            researchReady: true,
            results: pages,
            message:
                "Web research complete hui, lekin AI summarization fail ho gayi."
        };
    }
}


/* =========================================================
   WEB SEARCH
========================================================= */

async function performWebSearch(command) {

    const query =
        getSearchQuery(command);

    if (!query) {

        return {
            status: "error",
            intent: "web_search",
            message:
                "Kya search karna hai?"
        };
    }

    const result =
        await searchWeb(query);

    if (
        !result ||
        result.status !== "success"
    ) {

        return {
            status: "error",
            intent: "web_search",
            source: "web",
            query,
            results: [],
            message:
                result?.message ||
                "Web search nahi ho paayi."
        };
    }

    return {
        status: "success",
        intent: "web_search",
        source: "web",
        query,
        results:
            result.results || [],
        message:
            result.results &&
            result.results.length
                ? "Web search complete. Relevant results mil gaye."
                : "Search complete, lekin relevant results nahi mile."
    };
}


/* =========================================================
   MESSAGE COMMANDS
   Safe compose-first architecture
========================================================= */

function parseMessageCommand(command, type) {

    const text =
        String(command || "")
            .trim();


    if (type === "whatsapp") {

        const match =
            text.match(
                /^(?:whatsapp|whats\s*app)\s+(?:message|msg|text)\s+(.+?)\s+(?:saying|bolo|likho|message)\s+(.+)$/i
            );

        if (!match) {

            return {
                status: "error",
                intent: "whatsapp_message",
                message:
                    "Example: WhatsApp message Rahul saying hello bro."
            };
        }

        return {
            status: "success",
            intent: "whatsapp_message",
            action: "compose",
            recipient: match[1].trim(),
            messageText: match[2].trim(),
            requiresConfirmation: true,
            message:
                `WhatsApp message ready hai for ${match[1].trim()}. Send karne se pehle confirmation chahiye.`
        };
    }


    if (type === "instagram") {

        const match =
            text.match(
                /^(?:instagram|insta)\s+(?:message|msg|dm)\s+(.+?)\s+(?:saying|bolo|likho|message)\s+(.+)$/i
            );

        if (!match) {

            return {
                status: "error",
                intent: "instagram_message",
                message:
                    "Example: Instagram DM Rahul saying hello bro."
            };
        }

        return {
            status: "success",
            intent: "instagram_message",
            action: "compose",
            recipient: match[1].trim(),
            messageText: match[2].trim(),
            requiresConfirmation: true,
            message:
                `Instagram DM ready hai for ${match[1].trim()}. Send karne se pehle confirmation chahiye.`
        };
    }


    return {
        status: "error",
        intent: "message",
        message:
            "Message command samajh nahi aaya."
    };
}


/* =========================================================
   GMAIL COMPOSE
========================================================= */

function parseGmailCommand(command) {

    const text =
        String(command || "")
            .trim();


    const match =
        text.match(
            /^(?:gmail\s+(?:compose|mail|email)|send\s+(?:an\s+)?email)\s+(.+?)\s+(?:subject|sub)\s+(.+?)\s+(?:saying|body|message)\s+(.+)$/i
        );


    if (!match) {

        return {
            status: "error",
            intent: "gmail_compose",
            message:
                "Example: Gmail email Rahul subject Meeting saying Hello Rahul."
        };
    }


    return {
        status: "success",
        intent: "gmail_compose",
        action: "compose",
        recipient: match[1].trim(),
        subject: match[2].trim(),
        messageText: match[3].trim(),
        requiresConfirmation: true,
        message:
            `Gmail draft ready hai for ${match[1].trim()}. Send karne se pehle confirmation chahiye.`
    };
}


/* =========================================================
   COMMAND EXECUTION
========================================================= */

async function executeCommandInternal(command) {
    const normalizedCommand = String(command || "").trim();

    if (!normalizedCommand) {
        return {
            status: "error",
            intent: "empty",
            message: "Command is required."
        };
    }

    // Multi-step tasks use Planner -> Orchestrator.
    const plan = planner.planTask(normalizedCommand);

    if (plan && plan.success === true && plan.steps && plan.steps.length > 1) {
        return await orchestrator.executePlan(
            plan,
            normalizedCommand
        );
    }

    const detectedIntent = detectIntent(normalizedCommand);

    const registryResult =
        await agentRegistry.handleIntent(
            detectedIntent,
            command
        );

    if (registryResult) {
        return registryResult;
    }

    const intent =
        detectIntent(
            normalizedCommand
        );


    console.log(
        `[ULTRON] Command: "${normalizedCommand}" -> Intent: ${intent}`
    );


    switch (intent) {


        /* =================================================
           GREETING
        ================================================= */

        case "greeting":

            return {
                status: "success",
                intent: "greeting",
                message:
                    "Hey bro. ULTRON online. Kya karna hai?"
            };


        /* =================================================
           HELP
        ================================================= */

        case "help":

            return getHelpResponse();


        /* =================================================
           SYSTEM
        ================================================= */

        case "system_status":

            return await systemAgent.getSystemStatusResponse();


        /* =================================================
           NETWORK
        ================================================= */

        case "network_status":

            return await systemAgent.getNetworkStatusResponse();


        /* =================================================
           BATTERY
        ================================================= */

        case "battery_status":

            return await systemAgent.getBatteryStatusResponse();


        /* =================================================
           UPTIME
        ================================================= */

        case "uptime":

            return await systemAgent.getUptimeStatusResponse();


        /* =================================================
           MEMORY
        ================================================= */

        case "memory":

            return getMemoryResponse();


        case "memory_save":

            return saveMemoryResponse(
                normalizedCommand
            );


        case "memory_search":

            return searchMemoryResponse(
                normalizedCommand
            );


        case "memory_update":

            return updateMemoryResponse(
                normalizedCommand
            );


        case "memory_delete":

            return deleteMemoryResponse(
                normalizedCommand
            );


        case "memory_clear":

            return clearMemoryResponse();


        /* =================================================
           CALCULATOR
        ================================================= */

        case "calculate":

            return calculateResponse(normalizedCommand);


        /* =================================================
           ADVANCED
        ================================================= */

        case "advanced_skills":

            return {
                status: "success",
                intent: "advanced_skills",
                skills: SKILLS,
                message: "ULTRON skills ready hain."
            };

        case "advanced_workspace":

            return {
                status: "success",
                intent: "advanced_workspace",
                workspace: workspaceInfo(),
                entries: listWorkspace(""),
                message: "ULTRON workspace ready hai."
            };

        case "advanced_diagnostics":

            return {
                ...(await diagnostics()),
                intent: "advanced_diagnostics",
                message: "ULTRON diagnostics complete."
            };


        /* =================================================
           DESKTOP
        ================================================= */

        case "desktop_multi_action": {
            const typeMatch = normalizedCommand.match(
                /^(?:open|launch|start|run)\s+(.+?)\s+(?:and|then)\s+type\s+(.+)$/i
            );

            const openTwoMatch = normalizedCommand.match(
                /^(?:open|launch|start|run)\s+(.+?)\s+(?:and|then)\s+(?:(?:open|launch|start|run)\s+)?(.+)$/i
            );

            const appName = (name) => {
                const value = String(name || "").trim().toLowerCase();
                if (/^(?:notepad|note\s+pad)$/.test(value)) return "notepad";
                if (/^(?:calculator|calc)$/.test(value)) return "calculator";
                if (/^chrome$/.test(value)) return "chrome";
                if (/^(?:vscode|vs\s*code|visual\s+studio\s+code)$/.test(value)) return "vscode";
                if (/^youtube$/.test(value)) return "youtube";
                return null;
            };

            if (openTwoMatch) {
                const first = appName(openTwoMatch[1]);
                const second = appName(openTwoMatch[2]);
                if (!first || !second) {
                    return { status: "error", intent: "desktop_multi_action", message: "Unsupported multi-action app." };
                }
                const results = [];
                for (const action of [first, second]) {
                    if (action === "youtube") results.push(await openYouTube());
                    else results.push(await executeDesktopAction(action));
                }
                const failed = results.find(r => !r || r.success === false || r.status === "error");
                return failed
                    ? { status: "error", intent: "desktop_multi_action", message: failed.message || "Multi-action failed." }
                    : { status: "success", intent: "desktop_multi_action", message: "Apps exact order mein open kar diye." };
            }

            if (typeMatch) {
                const target = appName(typeMatch[1]);
                const textToType = typeMatch[2].trim();
                if (!target || target === "youtube") {
                    return { status: "error", intent: "desktop_multi_action", message: "Ye app type-action ke liye supported nahi hai." };
                }
                const opened = await executeDesktopAction(target);
                if (!opened || opened.success === false) {
                    return { status: "error", intent: "desktop_multi_action", message: opened?.message || "Desktop app open nahi hua." };
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await executeDesktopAction("type", textToType);
            }

            return { status: "error", intent: "desktop_multi_action", message: "Multi-action command samajh nahi aaya." };
        }

        case "keyboard_tab":
    return await executeDesktopAction("press_key", "tab");

case "keyboard_tab":
    return await executeDesktopAction("press_key", "tab");

case "keyboard_enter":
    return await executeDesktopAction("press_key", "enter");

case "keyboard_ctrl_a":
            return await executeDesktopAction("press_key", "ctrl+a");

        case "keyboard_ctrl_c":
            return await executeDesktopAction("press_key", "ctrl+c");

        case "keyboard_ctrl_v":
            return await executeDesktopAction("press_key", "ctrl+v");

        case "keyboard_ctrl_x":
            return await executeDesktopAction("press_key", "ctrl+x");

        case "keyboard_ctrl_s":
            return await executeDesktopAction("press_key", "ctrl+s");

        case "keyboard_ctrl_z":
            return await executeDesktopAction("press_key", "ctrl+z");

        case "keyboard_ctrl_y":
            return await executeDesktopAction("press_key", "ctrl+y");
        case "type_text": {

            const textToType = normalizedCommand.replace(/^type\s+/i, "").trim();

            return await executeDesktopAction("type", textToType);
        }


        case "open_calculator":

            return await openCalculator();


        case "open_notepad":

            return await openNotepad();


        case "open_chrome":

            return await openChrome();


        case "open_explorer":

            return await openExplorer();


        case "open_youtube":

            return await openYouTube();


        case "open_vscode":

            return await openVSCode();


        case "open_google":

            return await openGoogle();


        /* =================================================
           SOCIAL / WEB APPS
        ================================================= */

        case "open_whatsapp":

            return await openWhatsApp();


        case "open_instagram":

            return await openInstagram();


        case "open_gmail":

            return await openGmail();


        /* =================================================
           WEBSITE
        ================================================= */

        case "open_website":

            return await openWebsiteResponse(
                normalizedCommand
            );


        /* =================================================
           YOUTUBE SEARCH
        ================================================= */

        case "youtube_search":

            return await youtubeSearchResponse(
                normalizedCommand
            );


        /* =================================================
           WEB SEARCH
        ================================================= */

        case "web_search":

            return await performWebSearch(
                normalizedCommand
            );


        /* =================================================
           WEB RESEARCH
        ================================================= */

        case "web_research":

            return await performWebResearch(
                normalizedCommand
            );


        /* =================================================
           WHATSAPP MESSAGE
        ================================================= */

        case "whatsapp_message":

            return parseMessageCommand(
                normalizedCommand,
                "whatsapp"
            );


        /* =================================================
           INSTAGRAM MESSAGE
        ================================================= */

        case "instagram_message":

            return parseMessageCommand(
                normalizedCommand,
                "instagram"
            );


        /* =================================================
           GMAIL
        ================================================= */

        case "gmail_compose":

            return parseGmailCommand(
                normalizedCommand
            );


        /* =================================================
           UNKNOWN
        ================================================= */

        case "unknown":

        default: {
            const { processAIMessage } =
                require("../services/aiService");

            return await processAIMessage(
                normalizedCommand
            );
        }
    }
}


/* =========================================================
   PUBLIC EXECUTOR
========================================================= */

async function executeCommand(command) {

    try {

        return await executeCommandInternal(
            command
        );

    } catch (error) {

        let intent =
            "command";

        try {

            intent =
                detectIntent(command);

        } catch {
            // Keep generic intent.
        }


        console.error(
            "[ULTRON] Command execution error:",
            error
        );


        return {
            status: "error",
            intent,
            message:
                "Command process nahi ho paaya."
        };
    }
}


/* =========================================================
   MEMORY READ
========================================================= */

function getMemoryResponse() {

    const memories =
        getMemories();


    if (
        !memories ||
        memories.length === 0
    ) {

        return {
            status: "success",
            intent: "memory",
            message:
                "Abhi meri memory mein kuch saved nahi hai."
        };
    }


    const memoryText =
        memories
            .slice(-10)
            .reverse()
            .map(
                (memory, index) =>
                    `${index + 1}. ${memory.content}`
            )
            .join("\n");


    return {
        status: "success",
        intent: "memory",
        message:
            "Mujhe ye yaad hai:\n" +
            memoryText
    };
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
    executeCommand,
    detectIntent
};






































