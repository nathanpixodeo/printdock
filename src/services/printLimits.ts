export const PRINT_LIMITS = Object.freeze({
  jobBytes: 1024 * 1024,
  clients: 4,
  aggregateBytes: 8 * 1024 * 1024,
  queuedJobs: 20,
  idleMs: 10_000,
  receiveMs: 60_000,
  startMs: 15_000,
  stopMs: 5000,
  writeMs: 30_000,
});

export interface PrintLimits {
  aggregateBytes: number;
  clients: number;
  idleMs: number;
  jobBytes: number;
  queuedJobs: number;
  receiveMs: number;
  startMs: number;
  stopMs: number;
  writeMs: number;
}

export function validateEndpoint(port: number, localIp: string): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error('Port must be a whole number between 1024 and 65535.');
  }
  const parts = localIp.split('.');
  if (
    parts.length !== 4 ||
    !parts.every(
      (part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255,
    ) ||
    localIp === '0.0.0.0' ||
    localIp === '255.255.255.255' ||
    Number(parts[0]) >= 224 ||
    Number(parts[0]) === 127 ||
    Number(parts[0]) === 0
  ) {
    throw new Error('Select a valid local IPv4 address before starting.');
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function withDeadline<T>(
  operation: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
