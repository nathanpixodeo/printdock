import type { PrintLimits } from './printLimits';

// React Native uses the installed polyfill, not Node's built-in module.
// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer';

import { PRINT_LIMITS } from './printLimits';

export interface PrintSocket {
  destroy(): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

interface ReceivingClient {
  bytes: number;
  chunks: Buffer[];
  deadlineTimer: ReturnType<typeof setTimeout>;
  finished: boolean;
  idleTimer: ReturnType<typeof setTimeout>;
  socket: PrintSocket;
}

interface Job {
  bytes: number;
  data: Buffer;
}

export class PrintPipeline {
  private readonly clients = new Set<ReceivingClient>();
  private readonly queue: Job[] = [];
  private receivingBytes = 0;
  private queuedBytes = 0;
  private active = true;
  private writing: Promise<void> | null = null;

  constructor(
    private readonly write: (data: Buffer) => Promise<void>,
    private readonly onSent: () => void,
    private readonly onError: (message: string) => void,
    private readonly onWriteFailure: (message: string) => void,
    private readonly onQueueChange: (count: number) => void,
    private readonly limits: PrintLimits = PRINT_LIMITS,
  ) {}

  get queuedJobs(): number {
    return this.queue.length;
  }

  get hasUnsettledWrite(): boolean {
    return this.writing !== null;
  }

  accept(socket: PrintSocket): void {
    if (!this.active || this.clients.size >= this.limits.clients) {
      socket.destroy();
      this.onError(
        'Print connection rejected: client limit reached or server stopping.',
      );
      return;
    }

    const client: ReceivingClient = {
      socket,
      chunks: [],
      bytes: 0,
      idleTimer: setTimeout(
        () => this.reject(client, 'Print receive idle timeout.'),
        this.limits.idleMs,
      ),
      deadlineTimer: setTimeout(
        () => this.reject(client, 'Print receive deadline exceeded.'),
        this.limits.receiveMs,
      ),
      finished: false,
    };
    this.clients.add(client);

    socket.on('data', (chunk: unknown) => {
      if (client.finished) {
        return;
      }
      if (!Buffer.isBuffer(chunk)) {
        this.reject(client, 'Print data rejected: expected binary TCP bytes.');
        return;
      }
      if (
        client.bytes + chunk.length > this.limits.jobBytes ||
        this.receivingBytes + this.queuedBytes + chunk.length >
          this.limits.aggregateBytes
      ) {
        this.reject(client, 'Print data rejected: byte limit exceeded.');
        return;
      }
      client.chunks.push(chunk);
      client.bytes += chunk.length;
      this.receivingBytes += chunk.length;
      clearTimeout(client.idleTimer);
      client.idleTimer = setTimeout(
        () => this.reject(client, 'Print receive idle timeout.'),
        this.limits.idleMs,
      );
    });
    // react-native-tcp-socket 6.x reports orderly EOF as close(false), not an end event.
    socket.on('close', (error: unknown) => {
      if (client.finished) {
        return;
      }
      if (error !== false && error !== null && error !== undefined) {
        this.reject(client, 'Print receive failed; partial job discarded.');
        return;
      }
      const bytes = client.bytes;
      if (bytes > 0 && this.active) {
        if (this.queue.length >= this.limits.queuedJobs) {
          this.onError('Print job rejected: queue full.');
        } else {
          // One copy at EOF; the incoming chunks are released immediately afterward.
          const data = Buffer.concat(client.chunks, bytes);
          this.queue.push({ data, bytes });
          this.queuedBytes += bytes;
          this.onQueueChange(this.queue.length);
        }
      }
      this.finish(client);
      socket.destroy();
      this.pump();
    });
    socket.on('error', () =>
      this.reject(client, 'Print receive failed; partial job discarded.'),
    );
  }

  stop(): void {
    this.active = false;
    for (const client of this.clients) {
      this.finish(client);
      client.socket.destroy();
    }
    this.queue.length = 0;
    this.queuedBytes = 0;
    this.onQueueChange(0);
  }

  private reject(client: ReceivingClient, message: string): void {
    if (client.finished) {
      return;
    }
    this.finish(client);
    client.socket.destroy();
    if (this.active) {
      this.onError(message);
    }
  }

  private finish(client: ReceivingClient): void {
    client.finished = true;
    clearTimeout(client.idleTimer);
    clearTimeout(client.deadlineTimer);
    this.clients.delete(client);
    this.receivingBytes -= client.bytes;
    client.chunks.length = 0;
    client.bytes = 0;
  }

  private pump(): void {
    if (!this.active || this.writing || this.queue.length === 0) {
      return;
    }
    const job = this.queue.shift();
    if (!job) {
      return;
    }
    this.queuedBytes -= job.bytes;
    this.onQueueChange(this.queue.length);
    const operation = Promise.resolve().then(() => {
      if (this.active) {
        return this.write(job.data);
      }
    });
    this.writing = operation
      .then(
        () => {
          if (this.active) {
            this.onSent();
          }
        },
        (error: unknown) => {
          if (this.active) {
            this.stop();
            this.onWriteFailure(
              error instanceof Error ? error.message : String(error),
            );
          }
        },
      )
      .then(() => {
        this.writing = null;
        this.pump();
      });
  }
}
