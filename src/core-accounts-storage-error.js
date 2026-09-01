class CoreAccountsStorageError extends Error {
  constructor(message, statusCode = 502, errors = [], meta = {}) {
    super(message);
    this.name = 'CoreAccountsStorageError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.meta = meta;
  }
}

module.exports = { CoreAccountsStorageError };
