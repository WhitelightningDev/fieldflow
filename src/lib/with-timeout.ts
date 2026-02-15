export class TimeoutError extends Error {
  override name = "TimeoutError";
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

