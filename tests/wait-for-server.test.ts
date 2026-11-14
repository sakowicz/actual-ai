import waitForServer from '../src/utils/wait-for-server';

const noSleep = () => Promise.resolve();
const up = { ok: true };
const notReady = { ok: false };

describe('waitForServer', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns at once when the server is up', async () => {
    const fetchImpl = jest.fn<Promise<{ ok: boolean }>, [URL]>(() => Promise.resolve(up));

    await expect(waitForServer('http://actual:5006', { fetchImpl, sleep: noSleep })).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0].href).toBe('http://actual:5006/health');
  });

  it('keeps asking while the server is not reachable yet', async () => {
    const fetchImpl = jest.fn<Promise<{ ok: boolean }>, [URL]>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(notReady)
      .mockResolvedValueOnce(up);

    await expect(waitForServer('http://actual:5006/', { fetchImpl, sleep: noSleep })).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt so the run can report the error itself', async () => {
    const fetchImpl = jest.fn(() => Promise.reject(new TypeError('fetch failed')));
    const sleep = jest.fn(noSleep);

    await expect(waitForServer('http://actual:5006', { attempts: 3, fetchImpl, sleep })).resolves.toBe(false);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not wait when the server URL is not usable', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(up));

    await expect(waitForServer('', { fetchImpl, sleep: noSleep })).resolves.toBe(false);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
