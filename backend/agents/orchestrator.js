/**
 * ULTRON Task Orchestrator
 *
 * Phase 4 Step 3:
 * Executes a validated sequential plan through the Agent Registry.
 *
 * IMPORTANT:
 * This module does not interpret natural language.
 * Planner handles planning; Registry handles agent routing.
 */

const agentRegistry = require("./agentRegistry");

const MAX_STEPS = 5;

async function executePlan(plan, command = "") {
    if (!plan || plan.success !== true) {
        return {
            success: false,
            status: "rejected",
            command,
            steps: [],
            reason: "invalid_plan"
        };
    }

    if (
        plan.type !== "sequential" ||
        !Array.isArray(plan.steps) ||
        plan.steps.length === 0
    ) {
        return {
            success: false,
            status: "rejected",
            command,
            steps: [],
            reason: "invalid_plan_structure"
        };
    }

    if (plan.steps.length > MAX_STEPS) {
        return {
            success: false,
            status: "rejected",
            command,
            steps: [],
            reason: "too_many_steps"
        };
    }

    const results = [];

    for (const step of plan.steps) {
        if (
            !step ||
            typeof step.intent !== "string" ||
            !step.intent.trim()
        ) {
            results.push({
                id: step?.id || null,
                intent: step?.intent || null,
                status: "failed",
                reason: "invalid_step"
            });

            return {
                success: false,
                status: "failed",
                command,
                steps: results,
                reason: "invalid_step"
            };
        }

        /*
         * Phase 4 Step 3 intentionally uses Registry routing only.
         * Unsupported intents return null instead of being executed blindly.
         */
        const result = await agentRegistry.handleIntent(
            step.intent,
            command
        );

        if (result === null) {
            results.push({
                id: step.id,
                intent: step.intent,
                description: step.description,
                status: "unsupported"
            });

            return {
                success: false,
                status: "failed",
                command,
                steps: results,
                reason: "unsupported_intent"
            };
        }

        results.push({
            id: step.id,
            intent: step.intent,
            description: step.description,
            status: result.success === false ? "failed" : "completed",
            result
        });

        if (result.success === false) {
            return {
                success: false,
                status: "failed",
                command,
                steps: results,
                reason: "step_failed"
            };
        }
    }

    return {
        success: true,
        status: "completed",
        command,
        steps: results
    };
}

module.exports = {
    executePlan
};
