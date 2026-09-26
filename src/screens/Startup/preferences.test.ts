import { storage } from '@/hooks/language/storage';

import { getPort, getPrinterId, savePort, savePrinterId } from './preferences';

describe('print preferences', () => {
  beforeEach(() => storage.clearAll());

  it('restores only a valid port and preserves the previous value after invalid input', () => {
    expect(getPort()).toBe('9100');
    storage.set('printServer.port', '9100oops');
    expect(getPort()).toBe('9100');
    savePort('9200');
    savePort('80');
    expect(getPort()).toBe('9200');
  });

  it('persists a stable printer identifier and clears a removed selection', () => {
    expect(getPrinterId()).toBeNull();
    savePrinterId('AA:BB:CC:DD:EE:FF');
    expect(getPrinterId()).toBe('AA:BB:CC:DD:EE:FF');
    savePrinterId(null);
    expect(getPrinterId()).toBeNull();
  });

  it('never restores or persists a USB selection', () => {
    savePrinterId('AA:BB:CC:DD:EE:FF');
    savePrinterId('usb:1234:5678');
    expect(getPrinterId()).toBeNull();
    storage.set('printServer.printerId', 'usb:stale-device');
    expect(getPrinterId()).toBeNull();
  });
});
