import fs from 'fs';
import os from 'os';
import ActualApiService from '../src/actual-api-service';

function makeService(preferences: Record<string, string>): ActualApiService {
  const client = {
    getPreferences: jest.fn(() => Promise.resolve(preferences)),
  } as unknown as typeof import('@actual-app/api');
  return new ActualApiService(client, fs, os.tmpdir(), 'http://example.com', 'pw', '', 'budget', '', false);
}

describe('ActualApiService.getMoneyFormat', () => {
  test('returns the currency set in the budget', async () => {
    await expect(makeService({ defaultCurrencyCode: 'JPY' }).getMoneyFormat())
      .resolves.toEqual({ currencyCode: 'JPY', locale: 'en-US' });
  });

  test('returns an empty code and en-US when the budget sets neither', async () => {
    await expect(makeService({}).getMoneyFormat())
      .resolves.toEqual({ currencyCode: '', locale: 'en-US' });
  });

  test.each([
    { numberFormat: 'comma-dot', locale: 'en-US' },
    { numberFormat: 'dot-comma', locale: 'de-DE' },
    { numberFormat: 'space-comma', locale: 'fr-FR' },
    { numberFormat: 'apostrophe-dot', locale: 'de-CH' },
    { numberFormat: 'comma-dot-in', locale: 'en-IN' },
    { numberFormat: 'something new', locale: 'en-US' },
  ])('returns $locale for the number format $numberFormat', async ({ numberFormat, locale }) => {
    await expect(makeService({ defaultCurrencyCode: 'EUR', numberFormat }).getMoneyFormat())
      .resolves.toEqual({ currencyCode: 'EUR', locale });
  });
});
