const API_BASE_URL = "http://localhost:3000/api";


/* =========================================================
   SYSTEM STATUS
========================================================= */

async function getSystemStatus() {
    const response = await fetch(
        `${API_BASE_URL}/status`
    );

    if (!response.ok) {
        throw new Error(
            "System status request failed."
        );
    }

    return response.json();
}


/* =========================================================
   SYSTEM INFORMATION
========================================================= */

async function getSystemInformation() {
    const response = await fetch(
        `${API_BASE_URL}/system`
    );

    if (!response.ok) {
        throw new Error(
            "System information request failed."
        );
    }

    return response.json();
}


/* =========================================================
   AI STATUS
========================================================= */

async function getAIStatus() {
    const response = await fetch(
        `${API_BASE_URL}/ai/status`
    );

    if (!response.ok) {
        throw new Error(
            "AI status request failed."
        );
    }

    return response.json();
}


/* =========================================================
   MEMORY
========================================================= */

async function getMemories() {
    const response = await fetch(
        `${API_BASE_URL}/memory`
    );

    if (!response.ok) {
        throw new Error(
            "Memory request failed."
        );
    }

    return response.json();
}


async function saveMemory(type, content) {
    const response = await fetch(
        `${API_BASE_URL}/memory`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                type,
                content
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            "Memory save failed."
        );
    }

    return response.json();
}


async function clearMemories() {
    const response = await fetch(
        `${API_BASE_URL}/memory`,
        {
            method: "DELETE"
        }
    );

    if (!response.ok) {
        throw new Error(
            "Memory clear failed."
        );
    }

    return response.json();
}


/* =========================================================
   COMMAND
========================================================= */

async function sendCommand(command) {
    const response = await fetch(
        `${API_BASE_URL}/command`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                command
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            "Command request failed."
        );
    }

    return response.json();
}


/* =========================================================
   AI CHAT
========================================================= */

async function sendAIMessage(message) {
    const response = await fetch(
        `${API_BASE_URL}/ai/chat`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            "AI chat request failed."
        );
    }

    return response.json();
}

/* =========================================================
   ADVANCED ULTRON API
========================================================= */

async function getULTRONDiagnostics() {
    const response = await fetch(`${API_BASE_URL}/advanced/diagnostics`);
    if (!response.ok) throw new Error("Diagnostics request failed.");
    return response.json();
}

async function getULTRONSkills() {
    const response = await fetch(`${API_BASE_URL}/advanced/skills`);
    if (!response.ok) throw new Error("Skills request failed.");
    return response.json();
}

async function getULTRONWorkspace(relativePath = "") {
    const query = relativePath
        ? `?path=${encodeURIComponent(relativePath)}`
        : "";
    const response = await fetch(`${API_BASE_URL}/advanced/workspace${query}`);
    if (!response.ok) throw new Error("Workspace request failed.");
    return response.json();
}

async function executeULTRONTask(task) {
    const response = await fetch(`${API_BASE_URL}/advanced/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task)
    });
    if (!response.ok) throw new Error("Task execution request failed.");
    return response.json();
}
