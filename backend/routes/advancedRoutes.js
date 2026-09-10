const express = require("express");
const {
    SKILLS,
    workspaceInfo,
    listWorkspace,
    diagnostics,
    executeTask,
    research
} = require("../services/advancedService");

const router = express.Router();

router.get("/advanced/skills", (req, res) => {
    res.json({ status: "success", skills: SKILLS });
});

router.get("/advanced/workspace", (req, res) => {
    try {
        res.json({
            status: "success",
            workspace: workspaceInfo(),
            entries: listWorkspace(req.query.path || "")
        });
    } catch (error) {
        res.status(400).json({ status: "error", message: error.message });
    }
});

router.get("/advanced/diagnostics", async (req, res) => {
    try {
        res.json(await diagnostics());
    } catch (error) {
        res.status(500).json({ status: "error", message: "Diagnostics failed.", error: error.message });
    }
});

router.post("/advanced/task", async (req, res) => {
    try {
        const result = await executeTask(req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ status: "error", message: error.message });
    }
});

router.get("/advanced/research", async (req, res) => {
    try {
        res.json(await research(req.query.q));
    } catch (error) {
        res.status(400).json({ status: "error", message: error.message });
    }
});

module.exports = router;
