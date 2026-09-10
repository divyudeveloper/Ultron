/* =========================================================
   ULTRON AI CONTROLLER
========================================================= */

const {
    getAIStatus,
    processAIMessage
} = require("../services/aiService");



/* =========================================================
   AI STATUS
========================================================= */

function aiStatus(req, res) {

    const result =
        getAIStatus();

    res.json(result);
}


/* =========================================================
   AI CHAT
========================================================= */

async function aiChat(req, res) {

    const {
        message
    } = req.body;


    if (
        !message ||
        !String(message).trim()
    ) {

        return res.status(400).json({
            status: "error",
            message:
                "Message is required."
        });
    }


    try {

        /*
         * Generate ULTRON response first.
         * This keeps the current user message
         * out of the previous-conversation context.
         */
        const result =
            await processAIMessage(
                message
            );


        if (
            result.status === "error"
        ) {

            return res.status(400).json(
                result
            );
        }


        /* =============================================
           CONVERSATION HISTORY
        ============================================= */

        


        /*
         * Normal chat is NOT saved to
         * long-term memory anymore.
         *
         * Only meaningful memories will
         * be saved explicitly through the
         * memory system.
         */


        return res.json(
            result
        );


    } catch (error) {

        console.error(
            "ULTRON AI error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "ULTRON AI service failed."
        });
    }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
    aiStatus,
    aiChat
};