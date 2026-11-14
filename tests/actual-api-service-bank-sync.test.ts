import fs from 'fs';
import os from 'os';
import ActualApiService from '../src/actual-api-service';

function makeService(runBankSync: jest.Mock<Promise<void>, []>): ActualApiService {
  const client = { runBankSync } as unknown as typeof import('@actual-app/api');
  return new ActualApiService(client, fs, os.tmpdir(), 'http://example.com', 'pw', '', 'budget', '', false);
}

describe('ActualApiService.runBankSync', () => {
  test('mutes what the API client logs during the sync', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const runBankSync = jest.fn<Promise<void>, []>(() => {
      console.log('bank sync chatter');
      return Promise.resolve();
    });

    await makeService(runBankSync).runBankSync();

    expect(runBankSync).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalledWith('bank sync chatter');
    logSpy.mockRestore();
  });
});
