import type { PrintSocket } from './printPipeline';

import { Buffer } from 'node:buffer';

import { PRINT_LIMITS } from './printLimits';
import { PrintPipeline } from './printPipeline';

class FakeSocket implements PrintSocket {
  private readonly handlers = new Map<
    string,
    Array<(...args: unknown[]) => void>
  >();
  destroyed = false;

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), listener]);
  }

  emit(event: string, value?: unknown): void {
    for (const listener of this.handlers.get(event) ?? []) {
      listener(value);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.emit('close');
  }
}

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('PrintPipeline raw TCP jobs', () => {
  const errors: string[] = [];
  const sent = jest.fn();
  let write: jest.Mock<Promise<void>, [Buffer]>;
  let pipeline: PrintPipeline;

  beforeEach(() => {
    jest.useFakeTimers();
    errors.length = 0;
    sent.mockClear();
    write = jest.fn().mockResolvedValue(undefined);
    pipeline = new PrintPipeline(
      write,
      sent,
      (message) => errors.push(message),
      (message) => errors.push(message),
      () => undefined,
    );
  });

  afterEach(() => {
    pipeline.stop();
    jest.useRealTimers();
  });

  it('preserves NUL and high bytes across chunks and writes only on EOF', async () => {
    const socket = new FakeSocket();
    pipeline.accept(socket);
    socket.emit('data', Buffer.from([0, 1]));
    socket.emit('data', Buffer.from([255, 128]));
    expect(write).not.toHaveBeenCalled();
    socket.emit('close', false);
    await flush();
    expect(write).toHaveBeenCalledWith(Buffer.from([0, 1, 255, 128]));
    expect(sent).toHaveBeenCalledTimes(1);
    expect(socket.destroyed).toBe(true);
  });

  it('does not write a completed receive if stopped before the next microtask', async () => {
    const socket = new FakeSocket();
    pipeline.accept(socket);
    socket.emit('data', Buffer.from([1]));
    socket.emit('close', false);
    pipeline.stop();
    await flush();
    expect(write).not.toHaveBeenCalled();
  });

  it('enforces the receive deadline even when data keeps the idle timer alive', () => {
    const socket = new FakeSocket();
    pipeline.accept(socket);
    for (let elapsed = 0; elapsed < PRINT_LIMITS.receiveMs; elapsed += 5000) {
      socket.emit('data', Buffer.from([1]));
      jest.advanceTimersByTime(5000);
    }
    expect(socket.destroyed).toBe(true);
    expect(errors).toContain('Print receive deadline exceeded.');
    expect(write).not.toHaveBeenCalled();
  });

  it('discards errored partial jobs, empty jobs, and errored close', async () => {
    const failed = new FakeSocket();
    pipeline.accept(failed);
    failed.emit('data', Buffer.from([1]));
    failed.emit('error', new Error('reset'));
    const closed = new FakeSocket();
    pipeline.accept(closed);
    closed.emit('data', Buffer.from([2]));
    closed.emit('close', true);
    const empty = new FakeSocket();
    pipeline.accept(empty);
    empty.emit('close', false);
    await flush();
    expect(write).not.toHaveBeenCalled();
    expect(errors).toHaveLength(2);
  });

  it('serializes FIFO writes and cancels waiting jobs on failure', async () => {
    let rejectFirst!: (error: Error) => void;
    write.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    for (const byte of [1, 2, 3]) {
      const socket = new FakeSocket();
      pipeline.accept(socket);
      socket.emit('data', Buffer.from([byte]));
      socket.emit('close', false);
    }
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(pipeline.queuedJobs).toBe(2);
    rejectFirst(new Error('link lost'));
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(pipeline.queuedJobs).toBe(0);
    expect(sent).not.toHaveBeenCalled();
    expect(errors).toContain('link lost');
  });

  it('starts the next job only after the previous write resolves', async () => {
    let finishFirst!: () => void;
    write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    );
    for (const byte of [1, 2]) {
      const socket = new FakeSocket();
      pipeline.accept(socket);
      socket.emit('data', Buffer.from([byte]));
      socket.emit('close', false);
    }
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
    finishFirst();
    await flush();
    await flush();
    expect(write).toHaveBeenNthCalledWith(1, Buffer.from([1]));
    expect(write).toHaveBeenNthCalledWith(2, Buffer.from([2]));
    expect(sent).toHaveBeenCalledTimes(2);
  });

  it('rejects oversize data, a fifth client, idle and slow receivers', () => {
    const sockets = Array.from({ length: 5 }, () => new FakeSocket());
    sockets.forEach((socket) => pipeline.accept(socket));
    expect(sockets[4]?.destroyed).toBe(true);
    sockets[0]?.emit('data', Buffer.alloc(PRINT_LIMITS.jobBytes + 1));
    expect(sockets[0]?.destroyed).toBe(true);
    jest.advanceTimersByTime(PRINT_LIMITS.idleMs);
    expect(sockets[1]?.destroyed).toBe(true);
    expect(sockets[2]?.destroyed).toBe(true);
    expect(sockets[3]?.destroyed).toBe(true);
    expect(errors.some((error) => error.includes('byte limit'))).toBe(true);
  });

  it('enforces aggregate bytes and waiting queue capacity', async () => {
    const limits = { ...PRINT_LIMITS, aggregateBytes: 3, queuedJobs: 1 };
    pipeline.stop();
    pipeline = new PrintPipeline(
      write,
      sent,
      (message) => errors.push(message),
      (message) => errors.push(message),
      () => undefined,
      limits,
    );
    let release!: () => void;
    write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = new FakeSocket();
    pipeline.accept(first);
    first.emit('data', Buffer.from([1]));
    first.emit('close', false);
    await flush();
    const second = new FakeSocket();
    pipeline.accept(second);
    second.emit('data', Buffer.from([2, 3]));
    second.emit('close', false);
    const third = new FakeSocket();
    pipeline.accept(third);
    third.emit('data', Buffer.from([4, 5]));
    expect(third.destroyed).toBe(true);
    expect(pipeline.queuedJobs).toBe(1);
    release();
    await flush();
    expect(write).toHaveBeenNthCalledWith(2, Buffer.from([2, 3]));
  });
});
