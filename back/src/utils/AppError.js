class AppError extends Error {
  constructor(message, code = "ERROR", status = 400, details = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = AppError;
