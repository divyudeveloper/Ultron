const config = {
    app: {
        name: "ULTRON",
        version: "2.0.0",
        environment: process.env.NODE_ENV || "development"
    },

    server: {
        port: Number(process.env.PORT) || 3000
    }
};

config.ai = {
    provider: (process.env.AI_PROVIDER || "ollama").toLowerCase(),

    fallbackToLocal:
        process.env.AI_FALLBACK_TO_LOCAL === "true",

    google: {
        apiKey: process.env.GEMINI_API_KEY || null,
        model: process.env.GEMINI_MODEL || null
    },

    openai: {
        apiKey: process.env.OPENAI_API_KEY || null,
        model: process.env.OPENAI_MODEL || null
    }
};
module.exports = config;
