import type { BluetoothDevice, UsbPrinterDevice } from './printServer';

import { Buffer } from 'node:buffer';
import { Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import {
  check,
  checkNotifications,
  request,
  requestNotifications,
  RESULTS,
} from 'react-native-permissions';
import TcpSocket from 'react-native-tcp-socket';

import { bluetoothSerial as BluetoothSerial } from './bluetoothSerial';
import { PRINT_LIMITS } from './printLimits';
import { PrintServerService } from './printServer';
import { usbPrinter } from './usbPrinter';

jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: { start: jest.fn(), stop: jest.fn() },
}));
jest.mock('./bluetoothSerial', () => ({
  bluetoothSerial: {
    isEnabled: jest.fn(),
    onDisconnected: jest.fn(),
    list: jest.fn(),
    connect: jest.fn(),
    isConnected: jest.fn(),
    disconnect: jest.fn(),
    write: jest.fn(),
  },
}));
jest.mock('./usbPrinter', () => ({
  usbPrinter: {
    isConnected: jest.fn(),
    onDisconnected: jest.fn(),
    list: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    write: jest.fn(),
  },
}));
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  checkNotifications: jest.fn(),
  request: jest.fn(),
  requestNotifications: jest.fn(),
  RESULTS: { GRANTED: 'granted', BLOCKED: 'blocked' },
  PERMISSIONS: {
    ANDROID: { BLUETOOTH_CONNECT: 'connect', BLUETOOTH_SCAN: 'scan' },
  },
}));
jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createServer: jest.fn() },
}));

type Handler = (error?: Error) => void;

class FakeServer {
  handlers = new Map<string, Handler>();
  address: { port: number; host: string } | null = null;
  closed = false;
  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  }
  listen(address: { port: number; host: string }, ready: () => void): void {
    this.address = address;
    ready();
  }
  close(done?: () => void): void {
    this.closed = true;
    done?.();
  }
  fail(message: string): void {
    this.handlers.get('error')?.(new Error(message));
  }
}

class FakeClient {
  private readonly handlers = new Map<
    string,
    Array<(...args: unknown[]) => void>
  >();
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), listener]);
  }
  emit(event: string, value?: unknown): void {
    for (const listener of this.handlers.get(event) ?? []) {
      listener(value);
    }
  }
  destroy(): void {
    this.emit('close');
  }
}

/** Test-only USB sink; no virtual printer is exposed by the application UI. */
class FakeUsbPrinter {
  readonly writes: Buffer[] = [];
  private connected = false;
  private sessionId = 0;
  private onDetach: (() => void) | null = null;
  failWriteNumber: number | null = null;

  async connect(deviceName: string): Promise<number> {
    if (deviceName !== usbDevice.deviceName) {
      throw new Error('Simulated USB device not attached.');
    }
    this.connected = true;
    this.sessionId += 1;
    return this.sessionId;
  }

  async disconnect(): Promise<boolean> {
    this.connected = false;
    this.onDetach = null;
    return true;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async write(data: Buffer): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Simulated USB device detached.');
    }
    if (this.failWriteNumber === this.writes.length + 1) {
      throw new Error('Simulated USB bulk OUT failure.');
    }
    this.writes.push(Buffer.from(data));
    return true;
  }

  onDisconnected(sessionId: number, listener: () => void): () => void {
    if (sessionId === this.sessionId) {
      this.onDetach = listener;
    }
    return () => {
      if (this.onDetach === listener) {
        this.onDetach = null;
      }
    };
  }

  detach(): void {
    this.connected = false;
    this.onDetach?.();
  }
}

function wireFakeUsb(fake: FakeUsbPrinter): void {
  jest.mocked(usbPrinter.connect).mockImplementation((id) => fake.connect(id));
  jest
    .mocked(usbPrinter.disconnect)
    .mockImplementation(() => fake.disconnect());
  jest
    .mocked(usbPrinter.isConnected)
    .mockImplementation(() => fake.isConnected());
  jest.mocked(usbPrinter.write).mockImplementation((data) => fake.write(data));
  jest
    .mocked(usbPrinter.onDisconnected)
    .mockImplementation((session, listener) =>
      fake.onDisconnected(session, listener),
    );
}

const device: BluetoothDevice = {
  id: 'printer-1',
  name: 'Printer',
  address: '00:11',
};
const usbDevice: UsbPrinterDevice = {
  deviceName: '/dev/bus/usb/001/002',
  id: 'usb:/dev/bus/usb/001/002',
  name: 'USB receipt printer',
  productId: 2,
  transport: 'usb',
  vendorId: 1,
};
const BRIDGE_BATCH_BYTES = 16 * 1024;
const flush = async (): Promise<void> => {
  for (let index = 0; index < 32; index += 1) {
    await Promise.resolve();
  }
};

describe('PrintServerService lifecycle', () => {
  let service: PrintServerService;
  let server: FakeServer;
  let accept: (socket: FakeClient) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new PrintServerService();
    server = new FakeServer();
    jest.mocked(TcpSocket.createServer).mockImplementation((connection) => {
      accept = connection as unknown as (socket: FakeClient) => void;
      return server as never;
    });
    jest.mocked(BackgroundService.start).mockImplementation(async (task) => {
      void task({});
    });
    jest.mocked(BackgroundService.stop).mockResolvedValue(undefined);
    jest.mocked(BluetoothSerial.isEnabled).mockResolvedValue(true);
    jest.mocked(BluetoothSerial.connect).mockResolvedValue(1);
    jest
      .mocked(BluetoothSerial.onDisconnected)
      .mockReturnValue(() => undefined);
    jest.mocked(BluetoothSerial.isConnected).mockResolvedValue(true);
    jest
      .mocked(BluetoothSerial.disconnect)
      .mockResolvedValue(undefined as never);
    jest.mocked(BluetoothSerial.write).mockResolvedValue(undefined as never);
    jest.mocked(usbPrinter.connect).mockResolvedValue(2);
    jest.mocked(usbPrinter.isConnected).mockResolvedValue(true);
    jest.mocked(usbPrinter.onDisconnected).mockReturnValue(() => undefined);
    jest.mocked(usbPrinter.disconnect).mockResolvedValue(true);
    jest.mocked(usbPrinter.write).mockResolvedValue(true);
    jest.mocked(usbPrinter.list).mockResolvedValue([]);
    jest.mocked(check).mockResolvedValue(RESULTS.GRANTED);
    jest.mocked(request).mockResolvedValue(RESULTS.GRANTED);
    jest
      .mocked(checkNotifications)
      .mockResolvedValue({ status: RESULTS.GRANTED, settings: {} as never });
    jest
      .mocked(requestNotifications)
      .mockResolvedValue({ status: RESULTS.GRANTED, settings: {} as never });
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      value: 33,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('binds the requested IPv4, publishes stable snapshots, and closes on stop', async () => {
    const onChange = jest.fn();
    const unsubscribe = service.subscribe(onChange);
    const original = service.getSnapshot();
    expect(service.getSnapshot()).toBe(original);
    await service.start(device, 9100, '192.168.1.7');
    expect(server.address).toEqual({ port: 9100, host: '192.168.1.7' });
    expect(service.getSnapshot().status).toBe('listening');
    expect(service.running).toBe(true);
    expect(onChange).toHaveBeenCalled();
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'already running',
    );
    await service.stop();
    expect(server.closed).toBe(true);
    expect(service.getSnapshot().status).toBe('stopped');
    unsubscribe();
  });

  it('passes raw Buffer chunks to the Bluetooth wrapper in order', async () => {
    await service.start(device, 9100, '192.168.1.7');
    const client = new FakeClient();
    accept(client);
    client.emit('data', Buffer.from([0, 255, 1]));
    client.emit('close', false);
    await flush();
    expect(BluetoothSerial.write).toHaveBeenCalledWith(
      Buffer.from([0, 255, 1]),
    );
    expect(service.getSnapshot().queuedJobs).toBe(0);
    await service.stop();
  });

  it('lists USB bulk printers without requesting Bluetooth access', async () => {
    jest.mocked(usbPrinter.list).mockResolvedValue([
      {
        id: usbDevice.deviceName,
        name: usbDevice.name,
        productId: 2,
        vendorId: 1,
      },
    ]);
    await expect(service.listUsbDevices()).resolves.toEqual([usbDevice]);
    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(BluetoothSerial.isEnabled).not.toHaveBeenCalled();
  });

  it('runs a USB job through the same TCP queue without Bluetooth calls', async () => {
    await service.start(usbDevice, 9100, '192.168.1.7');
    expect(service.getSnapshot().device).toEqual(usbDevice);
    expect(usbPrinter.connect).toHaveBeenCalledWith(usbDevice.deviceName);
    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(BluetoothSerial.connect).not.toHaveBeenCalled();
    const bytes = Buffer.from([0, 255, 1]);
    const client = new FakeClient();
    accept(client);
    client.emit('data', bytes);
    client.emit('close', false);
    await flush();
    expect(usbPrinter.write).toHaveBeenCalledWith(bytes);
    expect(BluetoothSerial.write).not.toHaveBeenCalled();
    await service.stop();
    expect(usbPrinter.disconnect).toHaveBeenCalled();
    expect(BluetoothSerial.disconnect).not.toHaveBeenCalled();
  });

  it('preserves two binary TCP jobs in order with a test-only simulated USB sink', async () => {
    const fake = new FakeUsbPrinter();
    wireFakeUsb(fake);
    const onSent = jest.fn();
    service.setListener({
      onError: jest.fn(),
      onPrintJobSent: onSent,
      onStatusChange: jest.fn(),
    });

    await service.start(usbDevice, 9100, '192.168.1.7');
    const first = new FakeClient();
    accept(first);
    first.emit('data', Buffer.from([0, 255]));
    first.emit('data', Buffer.from([128, 1]));
    first.emit('close', false);
    const second = new FakeClient();
    accept(second);
    second.emit('data', Buffer.from([27, 64, 10]));
    second.emit('close', false);
    await flush();

    expect(fake.writes).toEqual([
      Buffer.from([0, 255, 128, 1]),
      Buffer.from([27, 64, 10]),
    ]);
    expect(onSent).toHaveBeenCalledTimes(2);
    expect(BluetoothSerial.write).not.toHaveBeenCalled();
    await service.stop();
    expect(await fake.isConnected()).toBe(false);
  });

  it('marks a simulated USB bulk failure unknown and discards waiting work', async () => {
    const fake = new FakeUsbPrinter();
    fake.failWriteNumber = 1;
    wireFakeUsb(fake);
    await service.start(usbDevice, 9100, '192.168.1.7');
    for (const byte of [1, 2]) {
      const client = new FakeClient();
      accept(client);
      client.emit('data', Buffer.from([byte]));
      client.emit('close', false);
    }
    await flush();
    expect(fake.writes).toHaveLength(0);
    expect(service.getSnapshot().status).toBe('failed');
    expect(service.getSnapshot().lastError).toContain('outcome unknown');
    expect(service.getSnapshot().queuedJobs).toBe(0);
  });

  it('stops the server when the selected USB printer detaches', async () => {
    const fake = new FakeUsbPrinter();
    wireFakeUsb(fake);
    await service.start(usbDevice, 9100, '192.168.1.7');
    fake.detach();
    await flush();
    expect(service.getSnapshot().status).toBe('failed');
    expect(service.getSnapshot().lastError).toContain('disconnected');
    expect(usbPrinter.disconnect).toHaveBeenCalled();
  });

  it('fails a denied USB permission without starting Bluetooth', async () => {
    jest
      .mocked(usbPrinter.connect)
      .mockRejectedValueOnce(new Error('USB permission denied.'));
    await expect(service.start(usbDevice, 9100, '192.168.1.7')).rejects.toThrow(
      'USB permission denied',
    );
    expect(service.getSnapshot().status).toBe('failed');
    expect(BluetoothSerial.connect).not.toHaveBeenCalled();
    expect(TcpSocket.createServer).not.toHaveBeenCalled();
  });

  it('sends 16 KiB plus one binary byte in two ordered bridge writes', async () => {
    await service.start(device, 9100, '192.168.1.7');
    const bytes = Buffer.alloc(BRIDGE_BATCH_BYTES + 1, 0x80);
    bytes[0] = 0;
    bytes[BRIDGE_BATCH_BYTES - 1] = 255;
    bytes[BRIDGE_BATCH_BYTES] = 1;
    const client = new FakeClient();
    accept(client);
    client.emit('data', bytes);
    client.emit('close', false);
    await flush();
    expect(BluetoothSerial.write).toHaveBeenCalledTimes(2);
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      1,
      bytes.subarray(0, BRIDGE_BATCH_BYTES),
    );
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      2,
      bytes.subarray(BRIDGE_BATCH_BYTES),
    );
    expect(service.getSnapshot().queuedJobs).toBe(0);
    await service.stop();
  });

  it('checks connection before and after three ordered binary batches', async () => {
    await service.start(device, 9100, '192.168.1.7');
    expect(BluetoothSerial.isConnected).toHaveBeenCalledTimes(1);
    const bytes = Buffer.alloc(BRIDGE_BATCH_BYTES * 2 + 1, 0x80);
    bytes[0] = 0;
    bytes[BRIDGE_BATCH_BYTES - 1] = 255;
    bytes[BRIDGE_BATCH_BYTES] = 1;
    bytes[BRIDGE_BATCH_BYTES * 2 - 1] = 0;
    bytes[BRIDGE_BATCH_BYTES * 2] = 255;
    const client = new FakeClient();
    accept(client);
    client.emit('data', bytes);
    client.emit('close', false);
    await flush();
    expect(BluetoothSerial.isConnected).toHaveBeenCalledTimes(3);
    expect(BluetoothSerial.write).toHaveBeenCalledTimes(3);
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      1,
      bytes.subarray(0, BRIDGE_BATCH_BYTES),
    );
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      2,
      bytes.subarray(BRIDGE_BATCH_BYTES, BRIDGE_BATCH_BYTES * 2),
    );
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      3,
      bytes.subarray(BRIDGE_BATCH_BYTES * 2),
    );
    expect(
      jest.mocked(BluetoothSerial.isConnected).mock.invocationCallOrder[1]!,
    ).toBeLessThan(
      jest.mocked(BluetoothSerial.write).mock.invocationCallOrder[0]!,
    );
    expect(
      jest.mocked(BluetoothSerial.isConnected).mock.invocationCallOrder[2]!,
    ).toBeGreaterThan(
      jest.mocked(BluetoothSerial.write).mock.invocationCallOrder[2]!,
    );
    expect(service.getSnapshot().queuedJobs).toBe(0);
    await service.stop();
  });

  it('fails after three batches when the final connection check reports a disconnect', async () => {
    jest
      .mocked(BluetoothSerial.isConnected)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await service.start(device, 9100, '192.168.1.7');
    const client = new FakeClient();
    accept(client);
    client.emit('data', Buffer.alloc(BRIDGE_BATCH_BYTES * 2 + 1, 0x80));
    client.emit('close', false);
    await flush();
    expect(BluetoothSerial.write).toHaveBeenCalledTimes(3);
    expect(BluetoothSerial.isConnected).toHaveBeenCalledTimes(3);
    expect(
      jest.mocked(BluetoothSerial.isConnected).mock.invocationCallOrder[2]!,
    ).toBeGreaterThan(
      jest.mocked(BluetoothSerial.write).mock.invocationCallOrder[2]!,
    );
    expect(service.getSnapshot().status).toBe('failed');
    expect(service.getSnapshot().lastError).toContain('Printer disconnected');
    expect(service.getSnapshot().lastError).toContain('outcome unknown');
  });

  it('stops forwarding three batches when the second native write rejects', async () => {
    jest
      .mocked(BluetoothSerial.write)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('native write rejected'));
    await service.start(device, 9100, '192.168.1.7');
    const client = new FakeClient();
    accept(client);
    const bytes = Buffer.alloc(BRIDGE_BATCH_BYTES * 2 + 1, 0x80);
    client.emit('data', bytes);
    client.emit('close', false);
    await flush();
    expect(BluetoothSerial.write).toHaveBeenCalledTimes(2);
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      1,
      bytes.subarray(0, BRIDGE_BATCH_BYTES),
    );
    expect(BluetoothSerial.write).toHaveBeenNthCalledWith(
      2,
      bytes.subarray(BRIDGE_BATCH_BYTES, BRIDGE_BATCH_BYTES * 2),
    );
    expect(BluetoothSerial.isConnected).toHaveBeenCalledTimes(2);
    expect(service.getSnapshot().status).toBe('failed');
    expect(service.getSnapshot().lastError).toContain('native write rejected');
    expect(service.getSnapshot().lastError).toContain('outcome unknown');
  });

  it('stops after a write deadline and never forwards a queued job', async () => {
    jest
      .mocked(BluetoothSerial.write)
      .mockImplementation(() => new Promise(() => undefined));
    await service.start(device, 9100, '192.168.1.7');
    for (const byte of [1, 2]) {
      const client = new FakeClient();
      accept(client);
      client.emit('data', Buffer.from([byte]));
      client.emit('close', false);
    }
    await flush();
    expect(BluetoothSerial.write).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(PRINT_LIMITS.writeMs);
    expect(BluetoothSerial.write).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot().status).toBe('failed');
    expect(service.getSnapshot().lastError).toContain('outcome unknown');
  });

  it('keeps listening when Android notification permission is denied', async () => {
    jest
      .mocked(checkNotifications)
      .mockResolvedValue({ status: RESULTS.BLOCKED, settings: {} as never });
    jest
      .mocked(requestNotifications)
      .mockResolvedValue({ status: RESULTS.BLOCKED, settings: {} as never });
    await service.start(device, 9100, '192.168.1.7');
    expect(service.getSnapshot().status).toBe('listening');
    expect(service.getSnapshot().lastError).toContain('Notifications are off');
    await service.stop();
  });

  it('cancels a stalled connect promptly without waiting for its startup deadline', async () => {
    jest
      .mocked(BluetoothSerial.connect)
      .mockReturnValue(new Promise(() => undefined));
    const starting = service.start(device, 9100, '192.168.1.7');
    await flush();
    const rejected = expect(starting).rejects.toThrow('cancelled');
    await service.stop();
    await rejected;
    expect(service.getSnapshot().status).toBe('stopped');
    expect(TcpSocket.createServer).not.toHaveBeenCalled();
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'still settling',
    );
  });

  it('fails startup if the printer disconnects before the listener becomes ready', async () => {
    let disconnected!: () => void;
    jest
      .mocked(BluetoothSerial.onDisconnected)
      .mockImplementation((_session, listener) => {
        disconnected = listener;
        return jest.fn();
      });
    server.listen = jest.fn();
    const starting = service.start(device, 9100, '192.168.1.7');
    await flush();
    const rejected = expect(starting).rejects.toThrow('Printer disconnected');
    disconnected();
    await rejected;
    expect(service.getSnapshot().status).toBe('failed');
    expect(server.closed).toBe(true);
  });

  it('blocks restart until a timed-out cleanup settles', async () => {
    await service.start(device, 9100, '192.168.1.7');
    let release!: () => void;
    jest.mocked(BluetoothSerial.disconnect).mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve(true);
      }),
    );
    const stopping = service.stop();
    const rejected = expect(stopping).rejects.toThrow('shutdown timed out');
    await jest.advanceTimersByTimeAsync(PRINT_LIMITS.stopMs);
    await rejected;
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'still settling',
    );
    release();
    await flush();
    await service.start(device, 9100, '192.168.1.7');
    expect(service.running).toBe(true);
    await service.stop();
  });

  it('blocks restart until a cancelled late HeadlessJS task has been stopped', async () => {
    let lateTask!: () => Promise<void>;
    jest
      .mocked(BackgroundService.start)
      .mockImplementationOnce(async (task) => {
        lateTask = () => task({});
      });
    const starting = service.start(device, 9100, '192.168.1.7');
    await flush();
    const rejected = expect(starting).rejects.toThrow('cancelled');
    await service.stop();
    await rejected;
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'still settling',
    );
    void lateTask();
    await flush();
    await service.start(device, 9100, '192.168.1.7');
    expect(service.running).toBe(true);
    await service.stop();
  });

  it('requires successful cleanup after a native disconnect rejection', async () => {
    await service.start(device, 9100, '192.168.1.7');
    jest
      .mocked(BluetoothSerial.disconnect)
      .mockRejectedValueOnce(new Error('close failed'));
    await expect(service.stop()).rejects.toThrow('close failed');
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'Previous cleanup failed',
    );
    await service.stop();
    await service.start(device, 9100, '192.168.1.7');
    await service.stop();
  });

  it('rejects invalid endpoints before native side effects', async () => {
    await expect(service.start(device, 9100.5, '192.168.1.7')).rejects.toThrow(
      'whole number',
    );
    await expect(service.start(device, 9100, '0.0.0.0')).rejects.toThrow(
      'IPv4',
    );
    expect(BluetoothSerial.connect).not.toHaveBeenCalled();
    expect(BackgroundService.start).not.toHaveBeenCalled();
  });

  it('rolls back on a bind error', async () => {
    server.listen = () => server.fail('address in use');
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'address in use',
    );
    expect(server.closed).toBe(true);
    expect(BluetoothSerial.disconnect).toHaveBeenCalled();
    expect(service.getSnapshot().status).toBe('failed');
  });

  it('handles an error after listen by closing the server and failing the snapshot', async () => {
    await service.start(device, 9100, '192.168.1.7');
    server.fail('network lost');
    await flush();
    expect(server.closed).toBe(true);
    expect(service.getSnapshot().status).toBe('failed');
    expect(service.getSnapshot().lastError).toContain('network lost');
  });

  it('times out a stalled connect and rejects restart until it settles', async () => {
    let finish!: () => void;
    jest.mocked(BluetoothSerial.connect).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve(undefined as never);
      }) as never,
    );
    const starting = service.start(device, 9100, '192.168.1.7');
    await flush();
    jest.advanceTimersByTime(PRINT_LIMITS.startMs);
    await expect(starting).rejects.toThrow('timed out');
    expect(service.getSnapshot().status).toBe('failed');
    await expect(service.start(device, 9100, '192.168.1.7')).rejects.toThrow(
      'still settling',
    );
    finish();
    await flush();
    expect(BluetoothSerial.disconnect).toHaveBeenCalled();
  });

  it('stops a pending start and leaves no listening server', async () => {
    let finish!: () => void;
    jest.mocked(BluetoothSerial.connect).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve(undefined as never);
      }) as never,
    );
    const starting = service.start(device, 9100, '192.168.1.7');
    await flush();
    const stopping = service.stop();
    finish();
    await expect(starting).rejects.toThrow('cancelled');
    await stopping;
    expect(service.getSnapshot().status).toBe('stopped');
    expect(TcpSocket.createServer).not.toHaveBeenCalled();
  });
});
