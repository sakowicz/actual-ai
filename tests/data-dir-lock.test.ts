import fs from 'fs';
import os from 'os';
import path from 'path';
import ActualApiService from '../src/actual-api-service';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'actual-ai-lock-test-'));
}

describe('ActualApiService dataDir lock', () => {
  test('prevents concurrent runs from sharing the same dataDir', async () => {
    const dataDir = makeTmpDir();

    const client = {
      init: jest.fn(async () => {}),
      downloadBudget: jest.fn(async () => {}),
      shutdown: jest.fn(async () => {}),
      getCategoryGroups: jest.fn(),
      getCategories: jest.fn(),
      getPayees: jest.fn(),
      getAccounts: jest.fn(),
      getTransactions: jest.fn(),
      getRules: jest.fn(),
      getPayeeRules: jest.fn(),
      createRule: jest.fn(),
      updateTransaction: jest.fn(),
      runBankSync: jest.fn(),
      createCategory: jest.fn(),
      createCategoryGroup: jest.fn(),
      updateCategoryGroup: jest.fn(),
    } as any;

    const s1 = new ActualApiService(
      client,
      fs as any,
      dataDir,
      'http://example.com',
      'pw',
      'budget',
      '',
      true,
    );
    const s2 = new ActualApiService(
      client,
      fs as any,
      dataDir,
      'http://example.com',
      'pw',
      'budget',
      '',
      true,
    );

    await s1.initializeApi();

    await expect(s2.initializeApi()).rejects.toThrow(/Refusing to use shared dataDir/i);

    await s1.shutdownApi();

    // After the first run releases the lock, the second should be able to initialize.
    await expect(s2.initializeApi()).resolves.toBeUndefined();
    await s2.shutdownApi();
  });
});

