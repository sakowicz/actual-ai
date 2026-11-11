import fs from 'fs';
import os from 'os';
import path from 'path';
import ActualApiService from '../src/actual-api-service';

type InitMock = jest.Mock<Promise<void>, [Record<string, unknown>]>;

function makeClient(init: InitMock): typeof import('@actual-app/api') {
  const asyncNoop = jest.fn(async () => Promise.resolve());
  return {
    init,
    downloadBudget: asyncNoop,
    shutdown: asyncNoop,
  } as unknown as typeof import('@actual-app/api');
}

async function initWith(password: string, sessionToken: string): Promise<InitMock> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actual-ai-auth-test-'));
  const init: InitMock = jest.fn<Promise<void>, [Record<string, unknown>]>()
    .mockResolvedValue(undefined);
  const service = new ActualApiService(
    makeClient(init),
    fs,
    dataDir,
    'http://example.com',
    password,
    sessionToken,
    'budget',
    '',
    true,
  );
  await service.initializeApi();
  await service.shutdownApi();
  return init;
}

describe('ActualApiService authentication', () => {
  test('logs in with the password when no session token is set', async () => {
    const init = await initWith('pw', '');

    expect(init).toHaveBeenCalledWith(expect.objectContaining({ password: 'pw' }));
    expect(init.mock.calls[0][0]).not.toHaveProperty('sessionToken');
  });

  test('uses the session token instead of the password when set', async () => {
    const init = await initWith('pw', 'token-uuid');

    expect(init).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: 'token-uuid' }));
    expect(init.mock.calls[0][0]).not.toHaveProperty('password');
  });
});
