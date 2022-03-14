class DiscordError extends Error {
    constructor(details, error) {
      super(error ? error.message : details);
      // Discord related errors
      this.details = details;
      // JS errors
      if (error && error.stack) this.stack = error.stack;
      Error.captureStackTrace(this);
    }
  }
  
  module.exports = DiscordError;
  