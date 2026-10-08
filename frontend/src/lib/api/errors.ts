export class ApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "ApiError";
  }
  get status(): number {
    return this.httpStatus;
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "读取失败，请重新加载。";
}
