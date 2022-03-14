class ProviderError extends Error {
    constructor(details, error) {
      super(error ? error.message : details);
      // Provided related errors
      this.details = details;
      // JS errors
      if (error && error.stack) this.stack = error.stack;
      Error.captureStackTrace(this);
    }
  }
  
  module.exports = ProviderError;
  