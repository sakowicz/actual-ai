import suppressConsoleLogsAsync from '../src/utils';

describe('suppressConsoleLogsAsync', () => {
  const originalConsoleLog = console.log;

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('silences console.log only while the callback runs', async () => {
    let logDuringCallback: typeof console.log | undefined;

    await suppressConsoleLogsAsync(() => {
      logDuringCallback = console.log;
      return Promise.resolve();
    });

    expect(logDuringCallback).not.toBe(originalConsoleLog);
    expect(console.log).toBe(originalConsoleLog);
  });

  it('restores console.log when the callback throws', async () => {
    await expect(suppressConsoleLogsAsync(
      () => Promise.reject(new Error('bank sync failed')),
    )).rejects.toThrow('bank sync failed');

    expect(console.log).toBe(originalConsoleLog);
  });
});
