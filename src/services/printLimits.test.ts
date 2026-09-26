import { validateEndpoint, withDeadline } from './printLimits';

describe('print service validation and deadlines', () => {
  it('requires a whole port and a concrete IPv4 bind address', () => {
    expect(() => validateEndpoint(1024, '192.168.0.1')).not.toThrow();
    expect(() => validateEndpoint(65_535, '10.0.0.2')).not.toThrow();
    for (const port of [0, 1023, 65_536, 9100.5, Number.NaN]) {
      expect(() => validateEndpoint(port, '192.168.0.1')).toThrow();
    }
    for (const ip of [
      '0.0.0.0',
      '127.0.0.1',
      '192.168.1.256',
      '192.168.01.1',
      'printer.local',
      '224.0.0.1',
    ]) {
      expect(() => validateEndpoint(9100, ip)).toThrow();
    }
  });

  it('rejects stalled operations at the deadline and clears completed timers', async () => {
    jest.useFakeTimers();
    const stalled = withDeadline(
      new Promise<void>(() => undefined),
      25,
      'deadline reached',
    );
    jest.advanceTimersByTime(25);
    await expect(stalled).rejects.toThrow('deadline reached');
    await expect(
      withDeadline(Promise.resolve(1), 25, 'unreachable'),
    ).resolves.toBe(1);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
