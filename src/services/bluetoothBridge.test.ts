import { Buffer } from 'node:buffer';
import { DeviceEventEmitter } from 'react-native';

import { bluetoothSerial } from './bluetoothSerial';

jest.mock('react-native', () => ({
  NativeModules: {
    PrintDockBluetooth: { write: jest.fn().mockResolvedValue(true) },
  },
  DeviceEventEmitter: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}));

it('encodes raw Buffer bytes for the app-owned native writer', async () => {
  const { bluetoothSerial: bridge } = jest.requireActual(
    './bluetoothSerial',
  ) as {
    bluetoothSerial: { write(data: Buffer): Promise<boolean> };
  };
  const reactNative = jest.requireMock('react-native') as {
    NativeModules: { PrintDockBluetooth: { write: jest.Mock } };
  };
  await bridge.write(Buffer.from([0x00, 0xff, 0x80, 0x01]));
  expect(
    reactNative.NativeModules.PrintDockBluetooth.write,
  ).toHaveBeenCalledWith('AP+AAQ==');
});

it('ignores stale disconnects and removes the session subscription', () => {
  const remove = jest.fn();
  jest
    .mocked(DeviceEventEmitter.addListener)
    .mockReturnValue({ remove } as never);
  const listener = jest.fn();
  const unsubscribe = bluetoothSerial.onDisconnected(7, listener);
  const callback = jest.mocked(DeviceEventEmitter.addListener).mock
    .calls[0]?.[1];
  callback?.({ sessionId: 6 });
  callback?.(null);
  expect(listener).not.toHaveBeenCalled();
  callback?.({ sessionId: 7 });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect(remove).toHaveBeenCalledTimes(1);
});
