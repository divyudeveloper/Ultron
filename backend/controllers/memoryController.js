const {
    saveMemory,
    getMemories,
    clearMemories
} = require("../memory/memoryService");

function createMemory(req, res) {
    const { type, content } = req.body;

    if (!type || !content) {
        return res.status(400).json({
            status: "error",
            message: "Memory type and content are required."
        });
    }

    const memory = saveMemory(type, content);

    res.status(201).json({
        status: "success",
        memory
    });
}

function readMemories(req, res) {
    res.json({
        status: "success",
        memories: getMemories()
    });
}

function deleteMemories(req, res) {
    res.json(clearMemories());
}

module.exports = {
    createMemory,
    readMemories,
    deleteMemories
};