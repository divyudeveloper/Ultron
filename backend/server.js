const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const config = require("./config/config");

const {
    logInfo,
    logError,
    logWarning
} = require("./utils/logger");

const app = express();

const PORT = config.server.port;

console.log("PORT:", config.server.port);
console.log("ENV:", config.app.environment);


/* =========================================================
   ROUTES
========================================================= */

const statusRoutes =
    require("./routes/statusRoutes");

const aiRoutes =
    require("./routes/aiRoutes");

const memoryRoutes =
    require("./routes/memoryRoutes");

const commandRoutes =
    require("./routes/commandRoutes");

const advancedRoutes =
    require("./routes/advancedRoutes");

const errorHandler =
    require("./middleware/errorHandler");


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors({
    origin: [
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ]
}));

app.use(express.json());


/* =========================================================
   API ROUTES
========================================================= */

app.use(
    "/api",
    statusRoutes
);

app.use(
    "/api",
    aiRoutes
);

app.use(
    "/api",
    memoryRoutes
);

app.use(
    "/api",
    commandRoutes
);

app.use(
    "/api",
    advancedRoutes
);


/* =========================================================
   FRONTEND
========================================================= */

const frontendPath =
    path.join(
        __dirname,
        "../frontend"
    );

app.use(
    express.static(frontendPath)
);


/* =========================================================
   FRONTEND ENTRY
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "index.html"
            )
        );
    }
);


/* =========================================================
   404 HANDLER
========================================================= */

app.use(
    (req, res) => {

        logWarning(
            `Route not found: ${req.method} ${req.originalUrl}`
        );

        res.status(404).json({

            status: "error",

            message:
                "ULTRON route not found."
        });
    }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    errorHandler
);


/* =========================================================
   START SERVER
========================================================= */

app.listen( PORT, "127.0.0.1", () => {

        logInfo(
            `ULTRON backend running at http://localhost:${PORT}`
        );

        console.log(
            `ULTRON frontend available at http://localhost:${PORT}`
        );
    }
);


