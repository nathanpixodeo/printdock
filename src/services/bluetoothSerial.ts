import type { Buffer } from 'node:buffer';

import { DeviceEventEmitter, NativeModules } from 'react-native';

interface NativeBluetooth {
  connect(address: string): Promise<number>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  list(): Promise<Array<{ address: string; id: string; name: string }>>;
  write(base64: string): Promise<boolean>;
}

function nativeBluetooth(): NativeBluetooth {
  const module = NativeModules.AirPrintBluetooth as NativeBluetooth | undefined;
  if (!module) {
    throw new Error('Bluetooth printing requires the native Android app.');
  }
  return module;
}

export const bluetoothSerial = {
  connect: (address: string) => nativeBluetooth().connect(address),
  disconnect: () => nativeBluetooth().disconnect(),
  isConnected: () => nativeBluetooth().isConnected(),
  isEnabled: () => nativeBluetooth().isEnabled(),
  list: () => nativeBluetooth().list(),
  onDisconnected: (sessionId: number, listener: () => void) => {
    const subscription = DeviceEventEmitter.addListener(
      'AirPrintBluetoothDisconnected',
      (event: { sessionId?: number } | null) => {
        if (event?.sessionId === sessionId) {
          listener();
        }
      },
    );
    return () => subscription.remove();
  },
  write: (data: Buffer) => nativeBluetooth().write(data.toString('base64')),
};
