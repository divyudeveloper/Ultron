const systemAgent = require("./systemAgent");
const {
    executeAndVerifyApp
} = require("./desktopAgent");
const planner = require("./planner");

const registry = {
    system_status: systemAgent.getSystemStatusResponse,
    network_status: systemAgent.getNetworkStatusResponse,
    battery_status: systemAgent.getBatteryStatusResponse,
    uptime: systemAgent.getUptimeStatusResponse,

    open_calculator: () =>
        executeAndVerifyApp(
            "start calc.exe",
            "open_calculator",
            "CalculatorApp.exe",
            "Calculator",
            "Calculator open kar diya.",
            "Calculator open nahi ho paaya."
        ),

    open_notepad: () =>
        executeAndVerifyApp(
            "start notepad.exe",
            "open_notepad",
            "notepad.exe",
            "Notepad",
            "Notepad open kar diya.",
            "Notepad open nahi ho paaya."
        ),

    open_chrome: () =>
        executeAndVerifyApp(
            "start chrome",
            "open_chrome",
            "chrome.exe",
            "Chrome",
            "Chrome open kar diya.",
            "Chrome open nahi ho paaya."
        ),

    open_vscode: () =>
        executeAndVerifyApp(
            "start code",
            "open_vscode",
            "Code.exe",
            "VS Code",
            "VS Code open kar diya.",
            "VS Code open nahi ho paaya. Check karo ki 'code' command PATH mein available hai."
        ),

    open_youtube: () =>
        executeAndVerifyApp(
            'start "" "https://www.youtube.com"',
            "open_youtube",
            "chrome.exe",
            "YouTube",
            "YouTube open kar diya.",
            "YouTube open nahi ho paaya."
        )
};

function createPlan(command) {
    return planner.planTask(command);
}

async function handleIntent(intent, command) {
    const handler = registry[intent];

    if (!handler) {
        return null;
    }

    return await handler(command);
}

module.exports = {
    handleIntent,
    createPlan
};

