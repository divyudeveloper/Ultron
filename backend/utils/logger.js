function logInfo(message) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
}

function logError(message) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
}

function logWarning(message) {
    console.warn(`[WARNING] ${new Date().toISOString()} - ${message}`);
}

module.exports = {
    logInfo,
    logError,
    logWarning
};