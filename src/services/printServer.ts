import type { TcpServer } from 'react-native-tcp-socket';

import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import BluetoothSerial from 'react-native-bluetooth-serial';
import { check, PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import TcpSocket from 'react-native-tcp-socket';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
}

type PrintServerListener = {
  onStatusChange: (running: boolean) => void;
  onError: (error: string) => void;
  onPrintJobSent: () => void;
};

class PrintServerService {
  private server: TcpServer | null = null;
  private listener: PrintServerListener | null = null;
  private isRunning = false;

  setListener(listener: PrintServerListener): void {
    this.listener = listener;
  }

  removeListener(): void {
    this.listener = null;
  }

  get running(): boolean {
    return this.isRunning;
  }

  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS === 'android' && (Platform.Version as number) >= 31) {
      try {
        const scan = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
        if (scan !== RESULTS.GRANTED) {
          const result = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          if (result !== RESULTS.GRANTED) {
            return false;
          }
        }

        const connect = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
        if (connect !== RESULTS.GRANTED) {
          const result = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          if (result !== RESULTS.GRANTED) {
            return false;
          }
        }
      } catch {
        return false;
      }
    }
    return true;
  }

  async listDevices(): Promise<BluetoothDevice[]> {
    const hasPermissions = await this.requestBluetoothPermissions();
    if (!hasPermissions) {
      throw new Error('BLUETOOTH_PERMISSION_DENIED');
    }

    const isEnabled = await BluetoothSerial.isEnabled();
    if (!isEnabled) {
      await BluetoothSerial.enable();
    }

    return BluetoothSerial.list() as Promise<BluetoothDevice[]>;
  }

  async start(
    device: BluetoothDevice,
    port: number,
    localIp: string,
  ): Promise<void> {
    if (!device) {
      throw new Error('NO_DEVICE_SELECTED');
    }

    const isEnabled = await BluetoothSerial.isEnabled();
    if (!isEnabled) {
      throw new Error('BLUETOOTH_DISABLED');
    }

    await BluetoothSerial.connect(device.id);

    const serverTask = async () => {
      return new Promise<void>((resolve) => {
        this.server = TcpSocket.createServer((socket) => {
          let binaryData = Buffer.alloc(0);

          socket.on('data', (chunk: Buffer) => {
            binaryData = Buffer.concat([binaryData, chunk]);
          });

          socket.on('close', async () => {
            if (binaryData.length > 0) {
              try {
                await BluetoothSerial.write(binaryData);
                this.listener?.onPrintJobSent();
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : String(error);
                this.listener?.onError(`Print error: ${message}`);
              }
            }
          });

          socket.on('error', () => {
            // socket errors are expected when clients disconnect abruptly
          });
        });

        this.server.listen({ port, host: '0.0.0.0' }, () => {
          this.isRunning = true;
          this.listener?.onStatusChange(true);
          // server is listening, but we don't resolve - keep alive
        });

        // keep alive polling - resolves only when stop() is called
        const poll = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(poll);
            this.server?.close();
            this.server = null;
            resolve();
          }
        }, 1000);
      });
    };

    const options = {
      taskName: 'PrintServer',
      taskTitle: 'Print Server Running',
      taskDesc: `Listening on ${localIp}:${port}`,
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#007BFF',
      linkingURI: 'airprint://printserver/stop',
      parameters: {
        deviceId: device.id,
        port,
      },
    };

    await BackgroundService.start(serverTask, options);
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    try {
      await BackgroundService.stop();
    } catch {
      // service may already be stopped
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    try {
      await BluetoothSerial.disconnect();
    } catch {
      // may already be disconnected
    }

    this.listener?.onStatusChange(false);
  }
}

export const printServerService = new PrintServerService();
