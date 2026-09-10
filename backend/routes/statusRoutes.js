const express = require("express");
const config = require("../config/config");

const {
    getSystemInformation
} = require("../utils/systemMonitor");

const router = express.Router();


/* =========================================================
   BASIC ULTRON STATUS
========================================================= */

router.get("/status", (req, res) => {
    res.json({
        status: "online",
        assistant: "ULTRON",
        version: config.app.version,
        message: "ULTRON systems operational."
    });
});


/* =========================================================
   SYSTEM INFORMATION
========================================================= */

router.get("/system", async (req, res) => {
    try {
        const system =
            await getSystemInformation();

        res.json({
            status: "success",
            system: system
        });

    } catch (error) {
        console.error(
            "ULTRON system monitor error:",
            error
        );

        res.status(500).json({
            status: "error",
            message:
                "Unable to read system information."
        });
    }
});


module.exports = router;