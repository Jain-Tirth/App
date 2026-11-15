/**
 * Typed error thrown by the reopen call only. It carries structured data; the
 * page never renders its fields, it passes the error to `describeReopenError`.
 */
export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(init: { code: string; status: number }) {
    super('Request failed');
    this.name = 'AdminApiError';
    this.code = init.code;
    this.status = init.status;
  }
}
