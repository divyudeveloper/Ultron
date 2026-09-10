/* =========================================================
   ULTRON VOICE STATE
========================================================= */

const voiceState = {
    supported:
        "SpeechRecognition" in window ||
        "webkitSpeechRecognition" in window,

    listening: false,
    processing: false,
    autoListening: false,
    restartTimer: null
};

let recognition = null;


/* =========================================================
   SPEECH RECOGNITION SETUP
========================================================= */

if (voiceState.supported) {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;


    /* =====================================================
       VOICE RESULT
    ===================================================== */

    recognition.onresult = async (event) => {

        if (voiceState.processing) {
            console.warn("ULTRON voice result ignored: already processing.");
            return;
        }

        const resultIndex = event.resultIndex || 0;
        const result = event.results[resultIndex];

        if (!result || !result[0]) {
            console.warn("ULTRON voice result ignored: invalid result.");
            return;
        }

        const transcript =
            result[0].transcript.trim();

        if (!transcript) {
            console.warn("ULTRON voice result ignored: empty transcript.");
            return;
        }

        voiceState.processing = true;

        console.log(
            "ULTRON VOICE REQUEST START | transcript:",
            transcript,
            "| time:",
            Date.now()
        );

        const commandInput =
            document.getElementById("commandInput");

        if (commandInput) {
            commandInput.value = transcript;
        }

        const commandOutput =
            document.getElementById("commandOutput");

        if (commandOutput) {
            commandOutput.textContent =
                "PROCESSING VOICE...";
        }

        console.log(
            "ULTRON voice input:",
            transcript
        );


        /* =================================================
           CORE â†’ PROCESSING
        ================================================= */

        if (typeof setCoreState === "function") {
            setCoreState("processing");
        }


        /* =================================================
           SEND VOICE INPUT TO AI
        ================================================= */

        try {

            if (
                typeof sendAIMessage !==
                "function"
            ) {
                throw new Error(
                    "sendAIMessage is not available."
                );
            }


            const result =
                await sendAIMessage(
                    transcript
                );


            if (
                !result ||
                !result.message
            ) {
                throw new Error(
                    "ULTRON returned an empty response."
                );
            }


            console.log(
                "ULTRON voice response:",
                result.message
            );


            /* =============================================
               DISPLAY RESPONSE
            ============================================= */

            if (commandOutput) {
                commandOutput.textContent =
                    result.message;
            }


            /* =============================================
               CHAT UI
            ============================================= */

            if (
                typeof addChatMessage ===
                "function"
            ) {

                addChatMessage(
                    "YOU",
                    transcript,
                    "user-message"
                );

                addChatMessage(
                    "ULTRON",
                    result.message,
                    "ai-message"
                );
            }


            /* =============================================
               SPEAK RESPONSE
            ============================================= */

            if (
                typeof speakResponse ===
                "function"
            ) {

                speakResponse(
                    result.message
                );

            } else {

                setCoreState("idle");
            }


        } catch (error) {

            console.error(
                "ULTRON voice AI error:",
                error
            );


            if (commandOutput) {
                commandOutput.textContent =
                    "ULTRON AI request failed.";
            }


            if (typeof setCoreState === "function") {
                setCoreState("idle");
            }
        }
    };


    /* =====================================================
       VOICE START
    ===================================================== */

    recognition.onstart = () => {

        voiceState.listening = true;
        voiceState.processing = false;

        const voiceButton =
            document.getElementById("voiceButton");

        if (voiceButton) {

            voiceButton.classList.add(
                "listening"
            );

            voiceButton.textContent =
                "LISTENING...";
        }


        if (typeof setCoreState === "function") {
            setCoreState("listening");
        }


        console.log(
            "ULTRON voice listening..."
        );
    };


    /* =====================================================
       VOICE END
    ===================================================== */

    recognition.onend = () => {

        voiceState.listening = false;

        const voiceButton =
            document.getElementById("voiceButton");

        if (voiceButton) {

            voiceButton.classList.remove(
                "listening"
            );

            voiceButton.textContent =
                "VOICE";
        }


        console.log(
            "ULTRON voice stopped."
        );

        // Keep listening alive when Auto Voice mode is enabled.
        if (voiceState.autoListening && !voiceState.processing) {
            clearTimeout(voiceState.restartTimer);
            voiceState.restartTimer = setTimeout(() => {
                if (voiceState.autoListening && !voiceState.listening) {
                    try {
                        recognition.start();
                    } catch (error) {
                        console.warn("ULTRON auto voice restart:", error);
                    }
                }
            }, 350);
        }
    };


    /* =====================================================
       VOICE ERROR
    ===================================================== */

    recognition.onerror = (event) => {

        voiceState.listening = false;
        voiceState.processing = false;

        const voiceButton =
            document.getElementById("voiceButton");

        if (voiceButton) {

            voiceButton.classList.remove(
                "listening"
            );

            voiceButton.textContent =
                "VOICE";
        }


        if (typeof setCoreState === "function") {
            setCoreState("idle");
        }


        console.error(
            "ULTRON voice error:",
            event.error
        );
    };
}


/* =========================================================
   START VOICE RECOGNITION
========================================================= */

function startVoiceRecognition() {

    if (!recognition) {

        return {
            status: "error",
            message:
                "Voice recognition is not supported."
        };
    }


    if (voiceState.listening) {

        return {
            status: "error",
            message:
                "Voice recognition is already running."
        };
    }


    try {

        recognition.start();

        return {
            status: "success",
            message:
                "Voice recognition started."
        };

    } catch (error) {

        console.error(
            "ULTRON voice start error:",
            error
        );

        return {
            status: "error",
            message:
                "Unable to start voice recognition."
        };
    }
}




/* =========================================================
   CONTINUOUS / AUTO VOICE MODE
========================================================= */

function enableAutoVoice() {
    if (!recognition) {
        return {
            status: "error",
            message: "Voice recognition is not supported."
        };
    }

    voiceState.autoListening = true;
    const result = startVoiceRecognition();

    return {
        ...result,
        autoListening: true
    };
}

function disableAutoVoice() {
    voiceState.autoListening = false;
    clearTimeout(voiceState.restartTimer);
    return stopVoiceRecognition();
}


/* =========================================================
   STOP VOICE RECOGNITION
========================================================= */

function stopVoiceRecognition() {

    voiceState.autoListening = false;
    clearTimeout(voiceState.restartTimer);

    if (recognition) {
        recognition.stop();
    }

    voiceState.listening = false;

    const voiceButton =
        document.getElementById("voiceButton");

    if (voiceButton) {

        voiceButton.classList.remove(
            "listening"
        );

        voiceButton.textContent =
            "VOICE";
    }


    if (typeof setCoreState === "function") {
        setCoreState("idle");
    }


    return {
        status: "success",
        message:
            "Voice recognition stopped."
    };
}



function scheduleAutoVoiceRestart() {
    if (!voiceState.autoListening || !recognition) return;

    clearTimeout(voiceState.restartTimer);
    voiceState.restartTimer = setTimeout(() => {
        if (voiceState.autoListening && !voiceState.listening) {
            try {
                recognition.start();
            } catch (error) {
                console.warn("ULTRON auto voice restart:", error);
            }
        }
    }, 350);
}

/* =========================================================
   ULTRON SPEECH OUTPUT
========================================================= */

function speakResponse(text) {

    if (!("speechSynthesis" in window)) {

        console.warn(
            "Speech synthesis is not supported."
        );

        if (typeof setCoreState === "function") {
            setCoreState("idle");
        }

        scheduleAutoVoiceRestart();
        return;
    }


    if (typeof setCoreState === "function") {
        setCoreState("speaking");
    }


    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;


    utterance.onstart = () => {

        if (typeof setCoreState === "function") {
            setCoreState("speaking");
        }
    };


    utterance.onend = () => {

        if (typeof setCoreState === "function") {
            setCoreState("idle");
        }

        scheduleAutoVoiceRestart();
    };


    utterance.onerror = () => {

        if (typeof setCoreState === "function") {
            setCoreState("idle");
        }

        console.error(
            "ULTRON speech output error."
        );
    };


    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(
        utterance
    );
}





