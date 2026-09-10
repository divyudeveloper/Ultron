  /* =========================================================
   ULTRON PAGE RELOAD PROTECTION
========================================================= */

window.addEventListener("beforeunload", () => {

    console.warn(
        "?? ULTRON PAGE IS RELOADING / CLOSING"
    );

});


window.addEventListener("unload", () => {

    console.warn(
        "?? ULTRON UNLOAD EVENT FIRED"
    );

});
  console.log("?? ULTRON app.js LOADED:", new Date().toISOString());
  /* =========================================================
   ULTRON INITIALIZATION
========================================================= */

async function initializeULTRON() {
    const statusText =
        document.getElementById("status");

    const connectionText =
        document.getElementById("connectionText");

    const indicator =
        document.getElementById("indicator");

    const systemStatus =
        document.getElementById("systemStatus");

    const aiStatus =
        document.getElementById("aiStatus");

    const memoryCount =
        document.getElementById("memoryCount");

    const memoryList =
        document.getElementById("memoryList");


    /* SYSTEM MONITOR ELEMENTS */

    const cpuModel =
        document.getElementById("cpuModel");

    const cpuCores =
        document.getElementById("cpuCores");

    const ramUsage =
        document.getElementById("ramUsage");

    const osInfo =
        document.getElementById("osInfo");


    try {

        const [
            systemData,
            systemInfoData,
            aiData,
            memoryData
        ] = await Promise.all([
            getSystemStatus(),
            getSystemInformation(),
            getAIStatus(),
            getMemories()
        ]);


        setSystemState(systemData);

        setAIState(aiData);

        setMemoryState(
            memoryData.memories
        );


        /* =====================================================
           SYSTEM MONITOR INITIAL DATA
        ===================================================== */

        const systemInfo =
            systemInfoData.system;


        if (cpuModel) {
            cpuModel.textContent =
                systemInfo.cpu.model;
        }


        if (cpuCores) {
            cpuCores.textContent =
                systemInfo.cpu.cores;
        }


        if (ramUsage) {

            const totalGB =
                systemInfo.memory.total /
                1024 /
                1024 /
                1024;

            const usedGB =
                systemInfo.memory.used /
                1024 /
                1024 /
                1024;

            ramUsage.textContent =
                `${usedGB.toFixed(1)} / ${totalGB.toFixed(1)} GB`;
        }


        if (osInfo) {

            osInfo.textContent =
                systemInfo.platform.toUpperCase();
        }


        /* =====================================================
           MEMORY UI
        ===================================================== */

        if (memoryCount) {

            memoryCount.textContent =
                memoryData.memories.length;
        }


        if (memoryList) {

            if (
                memoryData.memories.length === 0
            ) {

                memoryList.textContent =
                    "No memories loaded.";

            } else {

                memoryList.innerHTML =
                    memoryData.memories
                        .map(memory => `
                            <div class="memory-entry">

                                <div class="memory-type">
                                    ${escapeHTML(
                                        memory.type
                                    )}
                                </div>

                                <div class="memory-content">
                                    ${escapeHTML(
                                        memory.content
                                    )}
                                </div>

                            </div>
                        `)
                        .join("");
            }
        }


        /* =====================================================
           MAIN SYSTEM STATUS
        ===================================================== */

        if (statusText) {

            statusText.textContent =
                "SYSTEM ONLINE";
        }


        if (connectionText) {

            connectionText.textContent =
                "ULTRON CORE CONNECTED";
        }


        if (indicator) {

            indicator.style.background =
                "#00ff66";

            indicator.style.boxShadow =
                "0 0 12px #00ff66";
        }


        if (systemStatus) {

            systemStatus.textContent =
                systemData.status.toUpperCase();
        }


        if (aiStatus) {

            aiStatus.textContent =
                aiData.status.toUpperCase();
        }


        console.log(
            "ULTRON SYSTEM:",
            getULTRONState()
        );


        console.log(
            "ULTRON SYSTEM INFO:",
            systemInfoData
        );


    } catch (error) {

        if (statusText) {

            statusText.textContent =
                "SYSTEM OFFLINE";
        }


        if (connectionText) {

            connectionText.textContent =
                "BACKEND CONNECTION FAILED";
        }


        if (systemStatus) {

            systemStatus.textContent =
                "OFFLINE";
        }


        if (aiStatus) {

            aiStatus.textContent =
                "OFFLINE";
        }


        if (memoryCount) {

            memoryCount.textContent =
                "0";
        }


        if (cpuModel) {

            cpuModel.textContent =
                "UNAVAILABLE";
        }


        if (cpuCores) {

            cpuCores.textContent =
                "--";
        }


        if (ramUsage) {

            ramUsage.textContent =
                "--";
        }


        if (osInfo) {

            osInfo.textContent =
                "OFFLINE";
        }


        if (indicator) {

            indicator.style.background =
                "#ff1800";

            indicator.style.boxShadow =
                "0 0 12px #ff1800";
        }


        console.error(
            "ULTRON initialization error:",
            error
        );
    }
}


/* =========================================================
   ULTRON CORE STATE
========================================================= */

const corePanel =
    document.querySelector(
        ".core-panel"
    );


function setCoreState(state) {

    if (!corePanel) {
        return;
    }


    corePanel.classList.remove(
        "core-idle",
        "core-listening",
        "core-processing",
        "core-speaking"
    );


    corePanel.classList.add(
        `core-${state}`
    );
}


setCoreState("idle");


/* =========================================================
   COMMAND SYSTEM
========================================================= */

const commandInput =
    document.getElementById(
        "commandInput"
    );

const commandButton =
    document.getElementById(
        "commandButton"
    );

const commandOutput =
    document.getElementById(
        "commandOutput"
    );


async function executeCommand() {
    console.warn(
        "🔥 EXECUTE COMMAND TRIGGERED",
        Date.now(),
        new Error().stack
    );

    if (
        !commandInput ||
        !commandOutput
    ) {
        return;
    }


    const command =
        commandInput.value.trim();


    if (!command) {

        commandOutput.textContent =
            "ENTER A COMMAND.";

        return;
    }


    setCoreState(
        "processing"
    );


    commandOutput.textContent =
        "PROCESSING...";


    try {

        const result =
            await sendCommand(command);


        commandOutput.textContent =
            result.message;


        addCommandToHistory(
            command,
            result.message
        );


        setCoreState(
            "speaking"
        );


        if (
            typeof speakResponse ===
            "function"
        ) {

            speakResponse(
                result.message
            );
        }


        setTimeout(() => {

            setCoreState("idle");

        }, 1200);


    } catch (error) {

        commandOutput.textContent =
            "COMMAND REQUEST FAILED.";


        setCoreState(
            "idle"
        );


        console.error(
            "ULTRON command error:",
            error
        );
    }


    commandInput.value =
        "";
}


if (commandButton) {

    commandButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            executeCommand();
        }
    );
}


if (commandInput) {

    commandInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                executeCommand();
            }
        }
    );
}


/* =========================================================
   VOICE CONTROLS
========================================================= */

const voiceButton =
    document.getElementById(
        "voiceButton"
    );


if (voiceButton) {

    voiceButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();


            setCoreState(
                "listening"
            );


            const result =
                startVoiceRecognition();


            if (
                commandOutput &&
                result
            ) {

                commandOutput.textContent =
                    result.message;
            }
        }
    );
}


const stopVoiceButton =
    document.getElementById(
        "stopVoiceButton"
    );


if (stopVoiceButton) {

    stopVoiceButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();


            stopVoiceRecognition();

              window.speechSynthesis.cancel();


            setCoreState(
                "idle"
            );


            if (commandOutput) {

                commandOutput.textContent =
                    "ULTRON VOICE OUTPUT STOPPED.";
            }
        }
    );
}


/* =========================================================
   COMMAND HISTORY
========================================================= */

const historyList =
    document.getElementById(
        "historyList"
    );

const clearHistoryButton =
    document.getElementById(
        "clearHistoryButton"
    );


function addCommandToHistory(
    command,
    response
) {

    if (!historyList) {
        return;
    }


    const entry =
        document.createElement(
            "div"
        );


    entry.className =
        "history-entry";


    entry.innerHTML = `
        <div class="history-command">
            &gt; ${escapeHTML(command)}
        </div>

        <div class="history-response">
            ${escapeHTML(response)}
        </div>
    `;


    if (
        historyList.textContent.trim() ===
        "No commands yet."
    ) {

        historyList.innerHTML =
            "";
    }


    historyList.prepend(
        entry
    );
}


if (clearHistoryButton) {

    clearHistoryButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();


            if (!historyList) {
                return;
            }


            historyList.innerHTML =
                "No commands yet.";
        }
    );
}


/* =========================================================
   MEMORY SYSTEM
========================================================= */

const memoryTypeInput =
    document.getElementById(
        "memoryType"
    );

const memoryContentInput =
    document.getElementById(
        "memoryContent"
    );

const saveMemoryButton =
    document.getElementById(
        "saveMemoryButton"
    );

const memorySaveStatus =
    document.getElementById(
        "memorySaveStatus"
    );

const clearMemoryButton =
    document.getElementById(
        "clearMemoryButton"
    );

const memoryClearStatus =
    document.getElementById(
        "memoryClearStatus"
    );

const memoryCountElement =
    document.getElementById(
        "memoryCount"
    );

const memoryListElement =
    document.getElementById(
        "memoryList"
    );


async function refreshMemoryUI() {

    try {

        const memoryData =
            await getMemories();


        setMemoryState(
            memoryData.memories
        );


        if (memoryCountElement) {

            memoryCountElement.textContent =
                memoryData.memories.length;
        }


        if (memoryListElement) {

            if (
                memoryData.memories.length ===
                0
            ) {

                memoryListElement.textContent =
                    "No memories loaded.";

            } else {

                memoryListElement.innerHTML =
                    memoryData.memories
                        .map(memory => `
                            <div class="memory-entry">

                                <div class="memory-type">
                                    ${escapeHTML(
                                        memory.type
                                    )}
                                </div>

                                <div class="memory-content">
                                    ${escapeHTML(
                                        memory.content
                                    )}
                                </div>

                            </div>
                        `)
                        .join("");
            }
        }


        return memoryData.memories;


    } catch (error) {

        console.error(
            "ULTRON memory refresh error:",
            error
        );

        throw error;
    }
}


if (saveMemoryButton) {

    saveMemoryButton.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();


            const type =
                memoryTypeInput
                    ? memoryTypeInput.value.trim()
                    : "";


            const content =
                memoryContentInput
                    ? memoryContentInput.value.trim()
                    : "";


            if (
                !type ||
                !content
            ) {

                if (memorySaveStatus) {

                    memorySaveStatus.textContent =
                        "ENTER TYPE AND MEMORY.";
                }

                return;
            }


            if (memorySaveStatus) {

                memorySaveStatus.textContent =
                    "SAVING...";
            }


            try {

                await saveMemory(
                    type,
                    content
                );


                if (memorySaveStatus) {

                    memorySaveStatus.textContent =
                        "MEMORY SAVED.";
                }


                if (memoryTypeInput) {

                    memoryTypeInput.value =
                        "";
                }


                if (memoryContentInput) {

                    memoryContentInput.value =
                        "";
                }


                await refreshMemoryUI();


            } catch (error) {

                if (memorySaveStatus) {

                    memorySaveStatus.textContent =
                        "MEMORY SAVE FAILED.";
                }


                console.error(
                    "ULTRON memory save error:",
                    error
                );
            }
        }
    );
}


if (clearMemoryButton) {

    clearMemoryButton.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();


            if (memoryClearStatus) {

                memoryClearStatus.textContent =
                    "CLEARING...";
            }


            try {

                const result =
                    await clearMemories();


                if (memoryClearStatus) {

                    memoryClearStatus.textContent =
                        result.message;
                }


                await refreshMemoryUI();


            } catch (error) {

                if (memoryClearStatus) {

                    memoryClearStatus.textContent =
                        "MEMORY CLEAR FAILED.";
                }


                console.error(
                    "ULTRON memory clear error:",
                    error
                );
            }
        }
    );
}


/* =========================================================
   AI CHAT
========================================================= */

const chatInput =
    document.getElementById(
        "chatInput"
    );

const chatButton =
    document.getElementById(
        "chatButton"
    );

const chatMessages =
    document.getElementById(
        "chatMessages"
    );

const chatStatus =
    document.getElementById(
        "chatStatus"
    );

const CHAT_STORAGE_KEY =
    "ultron_chat_history";


function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(value ?? "");


    return div.innerHTML;
}


function renderMarkdown(value) {

    let text = String(value ?? "")
        .replace(/\r\n/g, "\n")
        .trim();

    /* REMOVE SOURCES FROM MAIN ANSWER */
    text = text.replace(
        /\s*\*{2}SOURCES\*{2}[\s\S]*$/i,
        ""
    );

    text = text.replace(
        /\s*#{1,3}\s*SOURCES\s*[\s\S]*$/i,
        ""
    );

    text = text.trim();

    /* ESCAPE RAW HTML */
    text = escapeHTML(text);

    /* LINKS */
    text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    /* HEADINGS */
    text = text.replace(
        /^### (.+)$/gm,
        '<h3>$1</h3>'
    );

    text = text.replace(
        /^## (.+)$/gm,
        '<h2>$1</h2>'
    );

    text = text.replace(
        /^# (.+)$/gm,
        '<h1>$1</h1>'
    );

    /* BOLD */
    text = text.replace(
        /\*\*(.+?)\*\*/g,
        '<strong>$1</strong>'
    );

    /* BULLETS */
    const lines = text.split("\n");
    const output = [];
    let inList = false;

    for (const line of lines) {

        const match = line.match(/^\s*[-*]\s+(.+)$/);

        if (match) {

            if (!inList) {
                output.push("<ul>");
                inList = true;
            }

            output.push(`<li>${match[1]}</li>`);

        } else {

            if (inList) {
                output.push("</ul>");
                inList = false;
            }

            if (line.trim()) {
                output.push(`<p>${line}</p>`);
            }
        }
    }

    if (inList) {
        output.push("</ul>");
    }

    return output.join("");
}

function saveChatHistory() {

    if (!chatMessages) {
        return;
    }


    localStorage.setItem(
        CHAT_STORAGE_KEY,
        chatMessages.innerHTML
    );
}


function loadChatHistory() {

    if (!chatMessages) {
        return;
    }


    const savedHistory =
        localStorage.getItem(
            CHAT_STORAGE_KEY
        );


    if (savedHistory) {

        chatMessages.innerHTML =
            savedHistory;
    }


    scrollChatToBottom();
}


/* =========================================================
   CHAT AUTO-SCROLL
========================================================= */

function scrollChatToBottom() {

    if (!chatMessages) {
        return;
    }


    requestAnimationFrame(() => {

        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    });
}


/* =========================================================
   ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
    sender,
    message,
    className,
    sources = []
) {

    if (!chatMessages) {
        return;
    }


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        `chat-message ${className}`;


    const safeSender =
        escapeHTML(sender);


    const safeMessage =
        escapeHTML(message);


    let sourcesHTML = "";


    if (
        Array.isArray(sources) &&
        sources.length > 0
    ) {

        const sourceItems =
            sources
                .filter(source =>
                    source &&
                    source.url
                )
                .map(source => {

                    const title =
                        escapeHTML(
                            source.title ||
                            source.pageTitle ||
                            "Source"
                        );


                    const url =
                        escapeHTML(
                            source.url
                        );


                    return `
                        <li>
                            <a
                                href="${url}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ${title}
                            </a>
                        </li>
                    `;
                })
                .join("");


        if (sourceItems) {

            sourcesHTML = `
                <div class="chat-sources">
                    <div class="chat-sources-title">
                        SOURCES
                    </div>

                    <ul>
                        ${sourceItems}
                    </ul>
                </div>
            `;
        }
    }


    messageElement.innerHTML = `
        <div class="chat-sender">
            ${safeSender}
        </div>

        <div class="chat-text">
            ${renderMarkdown(message)}
        </div>

        ${sourcesHTML}
    `;


    chatMessages.appendChild(
        messageElement
    );


    saveChatHistory();

    scrollChatToBottom();
}

/* =========================================================
   SEND CHAT MESSAGE
   WITH PERFORMANCE DEBUGGING
========================================================= */

async function sendChatMessage() {

    if (
        !chatInput ||
        !chatMessages
    ) {
        return;
    }


    const message =
        chatInput.value.trim();


    if (!message) {
        return;
    }


    addChatMessage(
        "YOU",
        message,
        "user-message"
    );


    setCoreState(
        "processing"
    );


    chatInput.value =
        "";


    if (chatStatus) {

        chatStatus.textContent =
            "ULTRON PROCESSING...";
    }


    /* =====================================================
       PERFORMANCE TIMER
    ===================================================== */

    const startTime =
        performance.now();


    console.log(
        "[ULTRON] AI request started"
    );


    try {

        /* =================================================
           AI API REQUEST
        ================================================= */

        const result =
            await sendAIMessage(
                message
            );


        const responseTime =
            performance.now() -
            startTime;


        console.log(
            `[ULTRON] AI response received in ${(responseTime / 1000).toFixed(2)} seconds`
        );


        if (
            !result ||
            !result.message
        ) {

            throw new Error(
                "ULTRON returned an empty response."
            );
        }


        /* =================================================
           DISPLAY AI RESPONSE
        ================================================= */

        addChatMessage(
    "ULTRON",
    result.message,
    "ai-message",
    result.sources
);


        setCoreState(
            "speaking"
        );


        if (chatStatus) {

            chatStatus.textContent =
                `ULTRON READY • ${(responseTime / 1000).toFixed(2)}s`;
        }


        scrollChatToBottom();


        /* =================================================
           RETURN TO IDLE
        ================================================= */

        setTimeout(() => {

            setCoreState(
                "idle"
            );


            scrollChatToBottom();

        }, 1200);


    } catch (error) {

        const responseTime =
            performance.now() -
            startTime;


        console.error(
            `[ULTRON] AI request failed after ${(responseTime / 1000).toFixed(2)} seconds`,
            error
        );


        setCoreState(
            "idle"
        );


        addChatMessage(
            "SYSTEM",
            "AI CHAT REQUEST FAILED.",
            "system-message"
        );


        if (chatStatus) {

            chatStatus.textContent =
                "AI CONNECTION ERROR";
        }
    }
}


loadChatHistory();


if (chatButton) {

    chatButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            sendChatMessage();
        }
    );
}


if (chatInput) {

    chatInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendChatMessage();
            }
        }
    );
}


/* =========================================================
   LIVE SYSTEM MONITOR
========================================================= */

async function updateSystemMonitor() {

    try {

        const data =
            await getSystemInformation();


        const system =
            data.system;


        /* SYSTEM ELEMENTS */

        const cpuModel =
            document.getElementById(
                "cpuModel"
            );

        const cpuCores =
            document.getElementById(
                "cpuCores"
            );

        const ramUsage =
            document.getElementById(
                "ramUsage"
            );

        const osInfo =
            document.getElementById(
                "osInfo"
            );


        /* CPU GAUGE */

        const cpuUsageValue =
            document.getElementById(
                "cpuUsageValue"
            );

        const cpuUsageBar =
            document.getElementById(
                "cpuUsageBar"
            );


        /* RAM GAUGE */

        const ramUsageValue =
            document.getElementById(
                "ramUsageValue"
            );

        const ramUsageBar =
            document.getElementById(
                "ramUsageBar"
            );


        /* BATTERY */

        const batteryStatus =
            document.getElementById(
                "batteryStatus"
            );

        const batteryUsageValue =
            document.getElementById(
                "batteryUsageValue"
            );

        const batteryUsageBar =
            document.getElementById(
                "batteryUsageBar"
            );


        /* UPTIME */

        const systemUptime =
            document.getElementById(
                "systemUptime"
            );


        /* NETWORK */

        const networkStatus =
            document.getElementById(
                "networkStatus"
            );

        const networkInterface =
            document.getElementById(
                "networkInterface"
            );

        const networkAdapters =
            document.getElementById(
                "networkAdapters"
            );


        /* =====================================================
           CPU
        ===================================================== */

        if (cpuModel) {

            cpuModel.textContent =
                system.cpu.model;
        }


        if (cpuCores) {

            cpuCores.textContent =
                system.cpu.cores;
        }


        /* =====================================================
           RAM
        ===================================================== */

        if (ramUsage) {

            const totalGB =
                system.memory.total /
                1024 /
                1024 /
                1024;


            const usedGB =
                system.memory.used /
                1024 /
                1024 /
                1024;


            ramUsage.textContent =
                `${usedGB.toFixed(1)} / ${totalGB.toFixed(1)} GB`;
        }


        /* =====================================================
           OS
        ===================================================== */

        if (osInfo) {

            osInfo.textContent =
                system.platform.toUpperCase();
        }


        /* =====================================================
           CPU GAUGE
        ===================================================== */

        const cpuPercent =
            Number(
                system.cpu.usage
            ) || 0;


        if (cpuUsageValue) {

            cpuUsageValue.textContent =
                `${cpuPercent.toFixed(1)}%`;
        }


        if (cpuUsageBar) {

            cpuUsageBar.style.width =
                `${Math.min(
                    Math.max(
                        cpuPercent,
                        0
                    ),
                    100
                )}%`;
        }


        /* =====================================================
           RAM GAUGE
        ===================================================== */

        const ramPercent =
            Number(
                system.memory.usage
            ) || 0;


        if (ramUsageValue) {

            ramUsageValue.textContent =
                `${ramPercent.toFixed(1)}%`;
        }


        if (ramUsageBar) {

            ramUsageBar.style.width =
                `${Math.min(
                    Math.max(
                        ramPercent,
                        0
                    ),
                    100
                )}%`;
        }


        /* =====================================================
           BATTERY
        ===================================================== */

        if (
            system.battery &&
            system.battery.available
        ) {

            const batteryPercent =
                Number(
                    system.battery.percent
                ) || 0;


            if (batteryStatus) {

                batteryStatus.textContent =
                    system.battery.charging
                        ? `${batteryPercent}% CHARGING`
                        : `${batteryPercent}%`;
            }


            if (batteryUsageValue) {

                batteryUsageValue.textContent =
                    `${batteryPercent}%`;
            }


            if (batteryUsageBar) {

                batteryUsageBar.style.width =
                    `${Math.min(
                        Math.max(
                            batteryPercent,
                            0
                        ),
                        100
                    )}%`;
            }


        } else {

            if (batteryStatus) {

                batteryStatus.textContent =
                    "UNAVAILABLE";
            }


            if (batteryUsageValue) {

                batteryUsageValue.textContent =
                    "--";
            }


            if (batteryUsageBar) {

                batteryUsageBar.style.width =
                    "0%";
            }
        }


        /* =====================================================
           NETWORK
        ===================================================== */

        if (networkStatus) {

            networkStatus.textContent =
                system.network &&
                system.network.internet
                    ? "ONLINE"
                    : "OFFLINE";
        }


        if (networkInterface) {

            const interfaces =
                system.network?.interfaces || [];


            const wifiInterface =
                interfaces.find(
                    item =>
                        item.name ===
                        "Wi-Fi"
                );


            networkInterface.textContent =
                wifiInterface
                    ? "WI-FI"
                    : interfaces[0]?.name ||
                      "NONE";
        }


        if (networkAdapters) {

            networkAdapters.textContent =
                system.network?.interfaceCount ??
                0;
        }


        /* =====================================================
           UPTIME
        ===================================================== */

        const totalSeconds =
            Math.floor(
                Number(
                    system.uptime
                ) || 0
            );


        const days =
            Math.floor(
                totalSeconds /
                86400
            );


        const hours =
            Math.floor(
                (
                    totalSeconds %
                    86400
                ) / 3600
            );


        const minutes =
            Math.floor(
                (
                    totalSeconds %
                    3600
                ) / 60
            );


        const seconds =
            totalSeconds %
            60;


        if (systemUptime) {

            systemUptime.textContent =
                `${days}D ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }


    } catch (error) {

        console.error(
            "ULTRON live monitor error:",
            error
        );
    }
}


/* =========================================================
   START ULTRON
========================================================= */

initializeULTRON();


/* =========================================================
   START LIVE MONITOR
========================================================= */

updateSystemMonitor();


setInterval(
    updateSystemMonitor,
    5000
);



















