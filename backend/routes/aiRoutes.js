const express = require("express");

const {
    aiStatus,
    aiChat
} = require("../controllers/aiController");

const router = express.Router();

/* =========================================================
   AI STATUS
========================================================= */

router.get(
    "/ai/status",
    aiStatus
);


/* =========================================================
   AI CHAT
   Main route:
   POST /api/ai/chat
========================================================= */

router.post(
    "/ai/chat",
    aiChat
);


/* =========================================================
   AI CHAT COMPATIBILITY ROUTE
   POST /api/chat

   This allows frontend / testing to use:
   /api/chat
========================================================= */

router.post(
    "/chat",
    aiChat
);


module.exports = router;