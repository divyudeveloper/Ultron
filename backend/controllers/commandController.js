const {
    executeCommand
} = require("../commands/commandService");
const {
    processAIMessage
} = require("../services/aiService");



async function handleCommand(req, res) {

    console.log(
        "[ULTRON API] /api/command request received"
    );

    console.log(
        "[ULTRON API] Body:",
        req.body
    );


    const command =
        req.body &&
        req.body.command;


    
    if (typeof command !== "string" || !command.trim()) {
        return res.status(400).json({
            status: "error",
            message: "Command must be a non-empty string."
        });
    }

    if (command.length > 1000) {
        return res.status(413).json({
            status: "error",
            message: "Command is too long."
        });
    }

    const safeCommand = command.trim();


    try {

        console.log(
            "[ULTRON API] Executing:",
            safeCommand
        );
        let result =
            await executeCommand(safeCommand);

        if (
            result &&
            result.status === "success" &&
            result.intent === "unknown"
        ) {
            console.log(
                "[ULTRON API] Command unknown, routing to AI..."
            );

            result =
                await processAIMessage(safeCommand);
        }


        console.log(
            "[ULTRON API] Result:",
            result
        );


        return res
            .status(200)
            .json(result);


    } catch (error) {

        console.error(
            "[ULTRON API] Controller error:",
            error
        );


        return res.status(500).json({

            status: "error",

            message:
                "ULTRON command processing failed.",

            error:
                error.message
        });
    }
}


module.exports = {
    handleCommand
};




