const express = require("express");

const {
    createMemory,
    readMemories,
    deleteMemories
} = require("../controllers/memoryController");

const router = express.Router();

router.post("/memory", createMemory);
router.get("/memory", readMemories);
router.delete("/memory", deleteMemories);

module.exports = router;