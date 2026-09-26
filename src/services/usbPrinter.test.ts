import { Buffer } from 'node:buffer';
import { DeviceEventEmitter } from 'react-native';

import { usbPrinter } from './usbPrinter';

jest.mock('react-native', () => ({
  NativeModules: {
    PrintDockUsb: {
      connect: jest.fn().mockResolvedValue(3),
      disconnect: jest.fn().mockResolvedValue(true),
      isConnected: jest.fn().mockResolvedValue(true),
      list: jest.fn().mockResolvedValue([]),
      write: jest.fn().mockResolvedValue(true),
    },
  },
  DeviceEventEmitter: {
    addListener: jest.fn(),
  },
}));

it('forwards exact binary bytes as base64 to the native USB module', async () => {
  const reactNative = jest.requireMock('react-native') as {
    NativeModules: { PrintDockUsb: { write: jest.Mock } };
  };
  await usbPrinter.write(Buffer.from([0, 255, 128, 1]));
  expect(reactNative.NativeModules.PrintDockUsb.write).toHaveBeenCalledWith(
    'AP+AAQ==',
  );
});

it('passes the selected ephemeral device path to native connect', async () => {
  const reactNative = jest.requireMock('react-native') as {
    NativeModules: { PrintDockUsb: { connect: jest.Mock } };
  };
  await expect(usbPrinter.connect('/dev/bus/usb/001/002')).resolves.toBe(3);
  expect(reactNative.NativeModules.PrintDockUsb.connect).toHaveBeenCalledWith(
    '/dev/bus/usb/001/002',
  );
});

it('ignores a stale USB detach event and removes its listener', () => {
  const remove = jest.fn();
  jest
    .mocked(DeviceEventEmitter.addListener)
    .mockReturnValue({ remove } as never);
  const onDetach = jest.fn();
  const unsubscribe = usbPrinter.onDisconnected(3, onDetach);
  const event = jest.mocked(DeviceEventEmitter.addListener).mock.calls[0]?.[1];
  event?.({ sessionId: 2 });
  event?.(null);
  expect(onDetach).not.toHaveBeenCalled();
  event?.({ sessionId: 3 });
  expect(onDetach).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect(remove).toHaveBeenCalledTimes(1);
});
