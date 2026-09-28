// Errors that carry who is at fault, so route handlers answer with the right status.

/** The request itself is wrong (not a wallet address, a list already full): the caller can fix it. */
export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserInputError';
  }
}
