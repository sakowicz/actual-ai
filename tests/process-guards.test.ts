import installProcessGuards from '../src/utils/process-guards';

type Handler = (...args: unknown[]) => void;

function captureGuards(keepAlive: boolean): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  // Register against a spy so the real process keeps Jest's own handlers.
  const onSpy = jest.spyOn(process, 'on').mockImplementation((
    event: string | symbol,
    listener: (...args: never[]) => void,
  ) => {
    handlers.set(String(event), listener as Handler);
    return process;
  });

  installProcessGuards(keepAlive);
  onSpy.mockRestore();

  return handlers;
}

describe('installProcessGuards', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.exitCode = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.exitCode = undefined;
  });

  test('logs an unhandled rejection without killing a scheduled run', () => {
    const handlers = captureGuards(true);

    handlers.get('unhandledRejection')?.(new Error('network-failure'));

    expect(console.error).toHaveBeenCalledWith('Unhandled promise rejection:', 'network-failure');
    expect(process.exitCode).toBeUndefined();
  });

  test('logs an uncaught exception without killing a scheduled run', () => {
    const handlers = captureGuards(true);

    handlers.get('uncaughtException')?.(new Error('boom'));

    expect(console.error).toHaveBeenCalledWith('Uncaught exception:', 'boom');
    expect(process.exitCode).toBeUndefined();
  });

  test('reports a failure through the exit code when nothing is scheduled', () => {
    const handlers = captureGuards(false);

    handlers.get('unhandledRejection')?.(new Error('network-failure'));

    expect(process.exitCode).toBe(1);
  });
});
