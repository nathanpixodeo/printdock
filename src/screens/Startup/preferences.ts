import { storage } from '@/hooks/language/storage';

import { parsePort } from './config';

const PRINTER_KEY = 'printServer.printerId';
const PORT_KEY = 'printServer.port';

export function getPrinterId(): string | null {
  const id = storage.getString(PRINTER_KEY);
  return id && !id.startsWith('usb:') ? id : null;
}

export function savePrinterId(id: string | null): void {
  if (id && !id.startsWith('usb:')) {
    storage.set(PRINTER_KEY, id);
  } else {
    storage.delete(PRINTER_KEY);
  }
}

export function getPort(): string {
  const saved = storage.getString(PORT_KEY);
  return saved && parsePort(saved) !== null ? saved : '9100';
}

export function savePort(value: string): void {
  if (parsePort(value) !== null) {
    storage.set(PORT_KEY, value);
  }
}
