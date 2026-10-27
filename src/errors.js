/**
 * Error raised for user-facing failures (bad config, bad payload...).
 * `exitCode` is used by the CLI entry point as the process exit code.
 */
export class CliError extends Error {
  constructor(message, { exitCode = 1, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/**
 * Error raised when an HTTP call to the Coveo platform (or to the AWS file container) fails.
 */
export class HttpError extends Error {
  constructor(context, response, body) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    super(`${context} failed with status ${response.status}${statusText}`);
    this.name = 'HttpError';
    this.statusCode = response.status;
    this.statusMessage = response.statusText;
    this.body = body;
  }
}
