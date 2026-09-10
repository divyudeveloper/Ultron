/**
 * ULTRON Task Planner
 *
 * Phase 4 Step 1:
 * Converts known multi-step commands
 * into structured execution plans.
 *
 * IMPORTANT:
 * This module does NOT execute commands.
 */

const MAX_STEPS = 5;

const SUPPORTED_INTENTS = new Set([
    "open_calculator",
    "open_notepad",
    "open_chrome",
    "open_vscode"
]);

const APP_PATTERNS = [
    {
        intent: "open_calculator",
        pattern: /\b(calculator|calc)\b/i,
        description: "Open Calculator"
    },
    {
        intent: "open_notepad",
        pattern: /\b(notepad|note\s+pad)\b/i,
        description: "Open Notepad"
    },
    {
        intent: "open_chrome",
        pattern: /\b(chrome|browser)\b/i,
        description: "Open Chrome"
    },
    {
        intent: "open_vscode",
        pattern: /\b(vscode|vs\s+code|visual\s+studio\s+code)\b/i,
        description: "Open VS Code"
    }
];

function createStep(intent, description) {
    return {
        id: intent,
        intent,
        description,
        status: "pending"
    };
}

function planTask(command) {
    const text = String(command || "").trim().toLowerCase();

    if (!text) {
        return {
            success: false,
            reason: "empty_command",
            steps: []
        };
    }

    const steps = [];

    for (const app of APP_PATTERNS) {
        if (app.pattern.test(text)) {
            steps.push(
                createStep(
                    app.intent,
                    app.description
                )
            );
        }
    }

    // Preserve the order in which apps appear in the user's command.
    steps.sort((a, b) => {
        const appA = APP_PATTERNS.find(
            (app) => app.intent === a.intent
        );

        const appB = APP_PATTERNS.find(
            (app) => app.intent === b.intent
        );

        return text.search(appA.pattern) - text.search(appB.pattern);
    });

    if (steps.length < 2) {
        return {
            success: false,
            reason: "no_supported_plan",
            steps: []
        };
    }

    if (steps.length > MAX_STEPS) {
        return {
            success: false,
            reason: "too_many_steps",
            steps: []
        };
    }

    const invalidStep = steps.find(
        (step) => !SUPPORTED_INTENTS.has(step.intent)
    );

    if (invalidStep) {
        return {
            success: false,
            reason: "unsupported_intent",
            steps: []
        };
    }

    return {
        success: true,
        type: "sequential",
        steps
    };
}

module.exports = {
    planTask
};

