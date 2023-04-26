export class InvalidZipError extends Error {
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "InvalidZipError";
    this.originalError = originalError;
  }
}
