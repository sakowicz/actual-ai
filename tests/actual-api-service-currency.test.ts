import fs from 'fs';
import os from 'os';
import ActualApiService from '../src/actual-api-service';

function makeService(preferences: Record<string, string>): ActualApiService {
  const client = {
    getPreferences: jest.fn(() => Promise.resolve(preferences)),
  } as unknown as typeof import('@actual-app/api');
  return new ActualApiService(client, fs, os.tmpdir(), 'http://example.com', 'pw', '', 'budget', '', false);
}

describe('ActualApiService.getCurrencyCode', () => {
  test('returns the currency set in the budget', async () => {
    await expect(makeService({ defaultCurrencyCode: 'JPY' }).getCurrencyCode()).resolves.toBe('JPY');
  });

  test('returns an empty code when the budget has no currency', async () => {
    await expect(makeService({}).getCurrencyCode()).resolves.toBe('');
  });
});
