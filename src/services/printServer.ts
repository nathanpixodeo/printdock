import type { Buffer } from 'node:buffer';
import type { PrintLimits } from './printLimits';
import type { PrintSocket } from './printPipeline';

import { Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import {
  check,
  checkNotifications,
  PERMISSIONS,
  request,
  requestNotifications,
  RESULTS,
} from 'react-native-permissions';
import TcpSocket from 'react-native-tcp-socket';

import { bluetoothSerial as BluetoothSerial } from './bluetoothSerial';
import {
  errorMessage,
  PRINT_LIMITS,
  validateEndpoint,
  withDeadline,
} from './printLimits';
import { PrintPipeline } from './printPipeline';
import { usbPrinter } from './usbPrinter';

type TcpServer = ReturnType<typeof TcpSocket.createServer>;
// One bridge call carries four bounded native SPP writes.
const WRITE_BATCH_BYTES = 16 * 1024;
const USB_PERMISSION_START_MS = 60_000;

type PrinterTransport = Pick<
  typeof BluetoothSerial,
  'connect' | 'disconnect' | 'isConnected' | 'onDisconnected' | 'write'
>;

export interface BluetoothDevice {
  address: string;
  id: string;
  name: string;
  transport?: 'bluetooth';
}

export interface UsbPrinterDevice {
  deviceName: string;
  id: string;
  name: string;
  productId: number;
  transport: 'usb';
  vendorId: number;
}

export type PrintDevice = BluetoothDevice | UsbPrinterDevice;

export interface PrintServerSnapshot {
  device: PrintDevice | null;
  lastError: string | null;
  localIp: string | null;
  port: number | null;
  queuedJobs: number;
  running: boolean;
  status: 'stopped' | 'starting' | 'listening' | 'stopping' | 'failed';
}

type PrintServerListener = {
  onStatusChange: (running: boolean) => void;
  onError: (error: string) => void;
  onPrintJobSent: () => void;
};

const INITIAL_SNAPSHOT: PrintServerSnapshot = Object.freeze({
  status: 'stopped',
  running: false,
  device: null,
  port: null,
  localIp: null,
  lastError: null,
  queuedJobs: 0,
});

export class PrintServerService {
  private server: TcpServer | null = null;
  private pipeline: PrintPipeline | null = null;
  private listener: PrintServerListener | null = null;
  private readonly subscribers = new Set<() => void>();
  private snapshot: PrintServerSnapshot = INITIAL_SNAPSHOT;
  private operationTail: Promise<void> = Promise.resolve();
  private generation = 0;
  private stopSequence = 0;
  private cancelStartup: (() => void) | null = null;
  private unsubscribeTransport: (() => void) | null = null;
  private activeTransport: PrinterTransport | null = null;
  private pendingCleanup: Promise<void> | null = null;
  private cleanupFailed = false;
  private pendingConnect: Promise<unknown> | null = null;
  private pendingBackgroundStart: Promise<unknown> | null = null;
  private nativeWrite: Promise<unknown> | null = null;
  private writeAborted = false;

  constructor(private readonly limits: PrintLimits = PRINT_LIMITS) {}

  getSnapshot = (): PrintServerSnapshot => this.snapshot;

  subscribe = (subscriber: () => void): (() => void) => {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  };

  setListener(listener: PrintServerListener): void {
    this.listener = listener;
  }

  removeListener(): void {
    this.listener = null;
  }

  get running(): boolean {
    return this.snapshot.running;
  }

  private publish(update: Partial<PrintServerSnapshot>): void {
    const next = Object.freeze({ ...this.snapshot, ...update });
    if (
      Object.keys(update).every(
        (key) =>
          this.snapshot[key as keyof PrintServerSnapshot] ===
          next[key as keyof PrintServerSnapshot],
      )
    ) {
      return;
    }
    const previousRunning = this.snapshot.running;
    this.snapshot = next;
    for (const subscriber of this.subscribers) {
      subscriber();
    }
    if (previousRunning !== next.running) {
      this.listener?.onStatusChange(next.running);
    }
  }

  private report(message: string): void {
    this.publish({ lastError: message });
    this.listener?.onError(message);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private assertAndroid(): void {
    if (Platform.OS !== 'android') {
      throw new Error(
        'The TCP-to-printer bridge is supported on Android only.',
      );
    }
  }

  private async requirePermissions(scan: boolean): Promise<void> {
    this.assertAndroid();
    if (Number(Platform.Version) < 31) {
      return;
    }
    const permissions = scan
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        ]
      : [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT];
    for (const permission of permissions) {
      let status;
      try {
        status = await check(permission);
        if (status !== RESULTS.GRANTED) {
          status = await request(permission);
        }
      } catch (error) {
        throw new Error(
          `Bluetooth permission check failed: ${errorMessage(error)}`,
        );
      }
      if (status !== RESULTS.GRANTED) {
        throw new Error(
          status === RESULTS.BLOCKED
            ? 'Bluetooth permission is blocked. Allow nearby devices in Android Settings.'
            : 'Bluetooth permission is required. Allow nearby devices and try again.',
        );
      }
    }
  }

  private async notificationWarning(): Promise<string | null> {
    if (Number(Platform.Version) < 33) {
      return null;
    }
    try {
      let { status } = await checkNotifications();
      if (status !== RESULTS.GRANTED) {
        ({ status } = await requestNotifications(['alert']));
      }
      if (status === RESULTS.GRANTED) {
        return null;
      }
    } catch {
      // Android still permits a foreground service without notification permission.
    }
    return 'Notifications are off. Android may show the running service only in Task Manager; enable notifications in Settings for a visible status notification.';
  }

  async requestBluetoothPermissions(): Promise<boolean> {
    try {
      await this.requirePermissions(true);
      return true;
    } catch {
      return false;
    }
  }

  async listDevices(): Promise<BluetoothDevice[]> {
    await this.requirePermissions(true);
    if (!(await BluetoothSerial.isEnabled())) {
      throw new Error('Turn on Bluetooth, then retry listing paired printers.');
    }
    return (await BluetoothSerial.list()).map((device) => ({
      ...device,
      transport: 'bluetooth' as const,
    }));
  }

  async listUsbDevices(): Promise<UsbPrinterDevice[]> {
    this.assertAndroid();
    return (await usbPrinter.list()).map((device) => ({
      deviceName: device.id,
      id: `usb:${device.id}`,
      name: device.name,
      productId: device.productId,
      transport: 'usb',
      vendorId: device.vendorId,
    }));
  }

  start(device: PrintDevice, port: number, localIp: string): Promise<void> {
    const stopSequence = this.stopSequence;
    return this.serialize(async () => {
      if (stopSequence !== this.stopSequence) {
        throw new Error('Print server startup was cancelled.');
      }
      this.assertAndroid();
      validateEndpoint(port, localIp);
      if (!device?.id || (device.transport === 'usb' && !device.deviceName)) {
        throw new Error('Select an available Bluetooth or USB printer.');
      }
      if (
        this.snapshot.status !== 'stopped' &&
        this.snapshot.status !== 'failed'
      ) {
        throw new Error('Print server is already running or changing state.');
      }
      if (
        this.pendingConnect ||
        this.pendingBackgroundStart ||
        this.nativeWrite ||
        this.pendingCleanup
      ) {
        throw new Error(
          'A previous native operation is still settling; retry later.',
        );
      }
      if (this.cleanupFailed) {
        throw new Error(
          'Previous cleanup failed. Stop the server again before restarting.',
        );
      }
      const selectedDevice = Object.freeze({ ...device });
      const selectedTransport =
        selectedDevice.transport === 'usb' ? usbPrinter : BluetoothSerial;
      const connectionId =
        selectedDevice.transport === 'usb'
          ? selectedDevice.deviceName
          : selectedDevice.id;
      this.activeTransport = selectedTransport;
      const generation = ++this.generation;
      this.writeAborted = false;
      this.publish({
        status: 'starting',
        running: false,
        device: selectedDevice,
        port,
        localIp,
        lastError: null,
      });
      let cancelledByStop = false;
      let failStartup: ((error: Error) => void) | null = null;
      const cancellation = new Promise<never>((_resolve, reject) => {
        failStartup = reject;
        this.cancelStartup = () => {
          cancelledByStop = true;
          reject(new Error('Print server startup was cancelled.'));
        };
      });
      const startup = async (): Promise<void> => {
        if (selectedDevice.transport !== 'usb') {
          await this.requirePermissions(true);
        }
        if (this.generation !== generation) {
          throw new Error('Print server startup was cancelled.');
        }
        this.publish({ lastError: await this.notificationWarning() });
        if (this.generation !== generation) {
          throw new Error('Print server startup was cancelled.');
        }
        if (
          selectedDevice.transport !== 'usb' &&
          !(await BluetoothSerial.isEnabled())
        ) {
          throw new Error(
            'Turn on Bluetooth before starting the print server.',
          );
        }
        if (this.generation !== generation) {
          throw new Error('Print server startup was cancelled.');
        }
        const connect = Promise.resolve(
          selectedTransport.connect(connectionId),
        );
        this.pendingConnect = connect;
        connect
          .then(
            async () => {
              if (this.generation !== generation) {
                await selectedTransport.disconnect().catch(() => undefined);
              }
            },
            () => undefined,
          )
          .then(() => {
            if (this.pendingConnect === connect) {
              this.pendingConnect = null;
            }
          });
        const sessionId = await connect;
        if (this.generation !== generation) {
          throw new Error('Print server startup was cancelled.');
        }
        this.unsubscribeTransport = selectedTransport.onDisconnected(
          sessionId,
          () => {
            if (this.generation !== generation) {
              return;
            }
            const message =
              'Printer disconnected. Any in-flight receipt has an unknown outcome; check it before reprinting.';
            if (this.snapshot.status === 'starting') {
              failStartup?.(new Error(message));
            } else if (this.snapshot.status === 'listening') {
              this.report(message);
              void this.stopAfterFailure().catch(() => undefined);
            }
          },
        );
        if (!(await selectedTransport.isConnected())) {
          throw new Error(
            'Printer did not establish a connection. Check its cable or pairing and retry.',
          );
        }
        if (this.generation !== generation) {
          throw new Error('Print server startup was cancelled.');
        }
        let backgroundStart: Promise<unknown> | null = null;
        let listenerError: Error | null = null;
        const ready = new Promise<void>((resolve, reject) => {
          let taskEntered!: () => void;
          const taskEntry = new Promise<void>((entered) => {
            taskEntered = entered;
          });
          const task = async (): Promise<void> => {
            if (this.generation !== generation) {
              // A native start may resolve before HeadlessJS invokes its task.
              // Keep restart blocked until this late wrapper is stopped; otherwise
              // its library-owned stop callback could overwrite a newer session's.
              try {
                await BackgroundService.stop();
              } catch {
                this.cleanupFailed = true;
              } finally {
                taskEntered();
              }
              return new Promise<void>(() => undefined);
            }
            taskEntered();
            try {
              const server = TcpSocket.createServer((socket) => {
                if (
                  this.generation === generation &&
                  this.snapshot.status === 'listening'
                ) {
                  this.pipeline?.accept(socket as unknown as PrintSocket);
                } else {
                  socket.destroy();
                }
              });
              this.server = server;
              server.on('error', (error: unknown) => {
                if (this.generation !== generation) {
                  return;
                }
                const message = `TCP listener failed: ${errorMessage(error)}`;
                listenerError = new Error(message);
                reject(listenerError);
                if (this.snapshot.status === 'listening') {
                  this.report(message);
                  void this.stopAfterFailure().catch(() => undefined);
                }
              });
              server.on('close', () => {
                if (
                  this.generation === generation &&
                  this.snapshot.status === 'listening'
                ) {
                  this.report('TCP listener closed unexpectedly.');
                  void this.stopAfterFailure().catch(() => undefined);
                }
              });
              server.listen({ port, host: localIp }, () => {
                if (this.generation === generation) {
                  resolve();
                } else {
                  server.close();
                }
              });
            } catch (error) {
              reject(error);
            }
            // BackgroundService.stop owns its HeadlessJS wrapper's completion.
            // Resolving this task later would trigger the library's automatic stop
            // and could stop a newer session. No timer or resolver retains this promise.
            return new Promise<void>(() => undefined);
          };
          backgroundStart = Promise.resolve(
            BackgroundService.start(task, {
              taskName: 'PrintServer',
              taskTitle: 'PrintDock · Print server',
              taskDesc: `Listening on ${localIp}:${port}`,
              taskIcon: { name: 'printdock_monochrome', type: 'drawable' },
              color: '#087F70',
              linkingURI: 'airprint://printserver/stop',
              parameters: { deviceId: selectedDevice.id, port },
            }),
          );
          const trackedStart = Promise.all([backgroundStart, taskEntry]);
          this.pendingBackgroundStart = trackedStart;
          trackedStart
            .then(
              async () => {
                if (this.generation !== generation) {
                  await BackgroundService.stop().catch(() => undefined);
                }
              },
              (error: unknown) => reject(error),
            )
            .then(() => {
              if (this.pendingBackgroundStart === trackedStart) {
                this.pendingBackgroundStart = null;
              }
            });
        });
        await Promise.all([ready, backgroundStart]);
        if (listenerError) {
          throw listenerError;
        }
      };
      try {
        this.pipeline = new PrintPipeline(
          (bytes) => this.write(bytes),
          () => {
            this.listener?.onPrintJobSent();
            this.publish({ queuedJobs: this.pipeline?.queuedJobs ?? 0 });
          },
          (message) => this.report(message),
          (message) => {
            this.report(
              `Printer write failed or timed out; job outcome unknown: ${message}`,
            );
            void this.stopAfterFailure().catch(() => undefined);
          },
          (count) => this.publish({ queuedJobs: count }),
          this.limits,
        );
        await withDeadline(
          Promise.race([startup(), cancellation]),
          selectedDevice.transport === 'usb'
            ? Math.max(this.limits.startMs, USB_PERMISSION_START_MS)
            : this.limits.startMs,
          'Print server startup timed out.',
        );
        if (this.generation !== generation) {
          throw new Error('Print server startup was cancelled.');
        }
        this.publish({ status: 'listening', running: true });
      } catch (error) {
        if (cancelledByStop) {
          this.publish({ status: 'stopping', running: false });
          throw error; // The already queued stop owns cleanup and its deadline.
        }
        const message = `Print server startup failed: ${errorMessage(error)}`;
        ++this.generation;
        let cleanupError: string | null = null;
        try {
          await this.cleanup();
        } catch (error_) {
          cleanupError = errorMessage(error_);
        }
        this.publish({
          status: 'failed',
          running: false,
          device: null,
          port: null,
          localIp: null,
        });
        this.report(
          cleanupError
            ? `${message}; cleanup failed: ${cleanupError}`
            : message,
        );
        throw new Error(this.snapshot.lastError ?? message);
      } finally {
        this.cancelStartup = null;
      }
    });
  }

  stop(): Promise<void> {
    ++this.stopSequence;
    ++this.generation;
    this.writeAborted = true;
    this.cancelStartup?.();
    this.pipeline?.stop();
    return this.serialize(async () => {
      if (this.snapshot.status === 'stopped') {
        return;
      }
      ++this.generation;
      this.publish({ status: 'stopping', running: false });
      try {
        await this.cleanup();
        this.publish({
          status: 'stopped',
          device: null,
          port: null,
          localIp: null,
          queuedJobs: 0,
        });
      } catch (error) {
        const message = `Print server shutdown failed: ${errorMessage(error)}`;
        this.publish({
          status: 'failed',
          device: null,
          port: null,
          localIp: null,
        });
        this.report(message);
        throw new Error(message);
      }
    });
  }

  private stopAfterFailure(): Promise<void> {
    return this.stop().then(() => {
      if (this.snapshot.status === 'stopped') {
        this.publish({ status: 'failed' });
      }
    });
  }

  private write(data: Buffer): Promise<void> {
    if (this.nativeWrite) {
      return Promise.reject(
        new Error('A printer write is already in progress.'),
      );
    }
    const transport = this.activeTransport;
    if (!transport) {
      return Promise.reject(new Error('No printer transport is connected.'));
    }
    const generation = this.generation;
    const operation = Promise.resolve().then(async () => {
      if (!(await transport.isConnected())) {
        throw new Error(
          'Printer disconnected before write. Reconnect it and submit a new job.',
        );
      }
      for (let offset = 0; offset < data.length; offset += WRITE_BATCH_BYTES) {
        if (this.writeAborted || this.generation !== generation) {
          throw new Error('Printer write cancelled; outcome unknown.');
        }
        // Native write checks its socket epoch before and after I/O, so a
        // connection-status bridge call between chunks is redundant.
        await transport.write(
          data.subarray(offset, offset + WRITE_BATCH_BYTES),
        );
      }
      // Keep the final check: a disconnect immediately after the last write
      // must not be reported as a successfully completed transport job.
      if (!(await transport.isConnected())) {
        throw new Error('Printer disconnected during write; outcome unknown.');
      }
    });
    this.nativeWrite = operation;
    operation.then(
      () => {
        if (this.nativeWrite === operation) {
          this.nativeWrite = null;
        }
      },
      () => {
        if (this.nativeWrite === operation) {
          this.nativeWrite = null;
        }
      },
    );
    return withDeadline(
      operation,
      this.limits.writeMs,
      'Printer write timed out.',
    ).then(
      () => undefined,
      (error: unknown) => {
        this.writeAborted = true;
        throw error;
      },
    );
  }

  private async cleanup(): Promise<void> {
    this.unsubscribeTransport?.();
    this.unsubscribeTransport = null;
    this.pipeline?.stop();
    this.pipeline = null;
    this.publish({ queuedJobs: 0 });
    if (this.pendingCleanup) {
      throw new Error(
        'Previous native cleanup is still settling; retry stopping later.',
      );
    }
    const server = this.server;
    const transport = this.activeTransport;
    const closeServer = server
      ? new Promise<void>((resolve, reject) => {
          try {
            server.close(() => {
              if (this.server === server) {
                this.server = null;
              }
              resolve();
            });
          } catch (error) {
            reject(error);
          }
        })
      : Promise.resolve();
    const cleanup = Promise.allSettled([
      closeServer,
      Promise.resolve().then(() => BackgroundService.stop()),
      transport
        ? Promise.resolve().then(() => transport.disconnect())
        : Promise.resolve(),
    ]).then((results) => {
      const error = results.find((result) => result.status === 'rejected');
      if (error?.status === 'rejected') {
        throw error.reason;
      }
    });
    this.pendingCleanup = cleanup;
    cleanup.then(
      () => {
        this.pendingCleanup = null;
        this.cleanupFailed = false;
        if (this.activeTransport === transport) {
          this.activeTransport = null;
        }
      },
      () => {
        this.pendingCleanup = null;
        this.cleanupFailed = true;
      },
    );
    await withDeadline(
      cleanup,
      this.limits.stopMs,
      'Print server shutdown timed out.',
    );
  }
}

export const printServerService = new PrintServerService();
