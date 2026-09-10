function errorHandler(err, req, res, next) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);

    res.status(err.statusCode || 500).json({
        status: "error",
        message: err.message || "ULTRON internal server error."
    });
}

module.exports = errorHandler;