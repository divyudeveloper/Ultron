/* =========================================================
   ULTRON CONVERSATION SERVICE
========================================================= */

const fs = require("fs");
const path = require("path");

const conversationFile = path.join(
    __dirname,
    "..",
    "data",
    "conversationHistory.json"
);


/* =========================================================
   READ CONVERSATION
========================================================= */

function readConversationFile() {
    try {

        if (!fs.existsSync(conversationFile)) {
            return [];
        }

        const data =
            fs.readFileSync(
                conversationFile,
                "utf-8"
            );

        if (!data.trim()) {
            return [];
        }

        const parsed =
            JSON.parse(data);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "ULTRON conversation read error:",
            error
        );

        return [];
    }
}


/* =========================================================
   WRITE CONVERSATION
========================================================= */

function writeConversationFile(messages) {

    const dataDirectory =
        path.dirname(conversationFile);

    if (!fs.existsSync(dataDirectory)) {

        fs.mkdirSync(
            dataDirectory,
            {
                recursive: true
            }
        );
    }

    fs.writeFileSync(
        conversationFile,
        JSON.stringify(
            messages,
            null,
            2
        ),
        "utf-8"
    );
}


/* =========================================================
   ADD CONVERSATION MESSAGE
========================================================= */

function addConversationMessage(
    role,
    content
) {

    const cleanRole =
        String(role || "").trim();

    const cleanContent =
        String(content || "").trim();

    if (
        !cleanRole ||
        !cleanContent
    ) {
        return null;
    }

    const messages =
        readConversationFile();

    const message = {
        id: Date.now(),
        role: cleanRole,
        content: cleanContent,
        createdAt:
            new Date().toISOString()
    };

    messages.push(message);

    /*
     * Keep only the latest 30 messages.
     */
    const trimmedMessages =
        messages.slice(-30);

    writeConversationFile(
        trimmedMessages
    );

    return message;
}


/* =========================================================
   GET RECENT CONVERSATION
========================================================= */

function getRecentConversation(
    limit = 12
) {

    const messages =
        readConversationFile();

    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 12,
                30
            )
        );

    return messages.slice(
        -safeLimit
    );
}


/* =========================================================
   BUILD AI CONVERSATION CONTEXT
========================================================= */

function buildConversationContext(
    limit = 12
) {

    const messages =
        getRecentConversation(limit);

    if (messages.length === 0) {
        return "No previous conversation.";
    }

    return messages
        .map(message => {

            const role =
                message.role === "assistant"
                    ? "ULTRON"
                    : "USER";

            let content =
                String(message.content || "");

            content =
                content.replace(/[\u0900-\u097F]/g, "");

            return `${role}: ${content}`;

        })
        .join("\n");
}


/* =========================================================
   CLEAR CONVERSATION
========================================================= */

function clearConversation() {

    writeConversationFile([]);

    return {
        status: "success",
        message:
            "ULTRON conversation history cleared."
    };
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
    addConversationMessage,
    getRecentConversation,
    buildConversationContext,
    clearConversation
};
