const ultronState = {
    system: {
        status: "offline",
        assistant: "ULTRON",
        version: "2.0.0"
    },

    ai: {
        status: "offline",
        module: "AI"
    },

    memory: {
        items: []
    }
};

function setSystemState(data) {
    ultronState.system = {
        ...ultronState.system,
        ...data
    };
}

function setAIState(data) {
    ultronState.ai = {
        ...ultronState.ai,
        ...data
    };
}

function setMemoryState(memories) {
    ultronState.memory.items = memories;
}

function getULTRONState() {
    return ultronState;
}