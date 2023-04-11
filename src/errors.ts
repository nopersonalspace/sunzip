export class InvalidZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidZipError";
  }
}
