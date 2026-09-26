export const MIN_PORT = 1024;
export const MAX_PORT = 65_535;

export function parsePort(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const port = Number(value);
  return Number.isSafeInteger(port) && port >= MIN_PORT && port <= MAX_PORT
    ? port
    : null;
}

export type PrintServerAction = 'start' | 'stop';

export function parsePrintServerLink(url: string): PrintServerAction | null {
  const match = /^printdock:\/\/printserver\/(start|stop)$/.exec(url);
  return (match?.[1] as PrintServerAction | undefined) ?? null;
}
