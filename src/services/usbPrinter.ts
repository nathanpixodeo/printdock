import type { Buffer } from 'node:buffer';

import { DeviceEventEmitter, NativeModules } from 'react-native';

export interface NativeUsbPrinter {
  id: string;
  name: string;
  productId: number;
  vendorId: number;
}

interface NativeUsbModule {
  connect(deviceName: string): Promise<number>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  list(): Promise<NativeUsbPrinter[]>;
  write(base64: string): Promise<boolean>;
}

function nativeUsb(): NativeUsbModule {
  const module = NativeModules.PrintDockUsb as NativeUsbModule | undefined;
  if (!module) {
    throw new Error('USB OTG printing requires the native Android app.');
  }
  return module;
}

export const usbPrinter = {
  connect: (deviceName: string) => nativeUsb().connect(deviceName),
  disconnect: () => nativeUsb().disconnect(),
  isConnected: () => nativeUsb().isConnected(),
  list: () => nativeUsb().list(),
  onDisconnected: (sessionId: number, listener: () => void) => {
    const subscription = DeviceEventEmitter.addListener(
      'PrintDockUsbDisconnected',
      (event: { sessionId?: number } | null) => {
        if (event?.sessionId === sessionId) {
          listener();
        }
      },
    );
    return () => subscription.remove();
  },
  write: (data: Buffer) => nativeUsb().write(data.toString('base64')),
};
