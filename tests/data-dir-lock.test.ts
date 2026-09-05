import fs from 'fs';
import os from 'os';
import path from 'path';
import ActualApiService from '../src/actual-api-service';
import { LOCK_STALE_MS } from '../src/utils/data-dir-lock';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'actual-ai-lock-test-'));
}

function lockPath(dataDir: string): string {
  return path.join(dataDir, '.actual-ai.lock');
}

function writeLock(dataDir: string, payload: Record<string, unknown>): void {
  fs.writeFileSync(lockPath(dataDir), JSON.stringify(payload));
}

function makeClient(
  overrides: Partial<Record<string, unknown>> = {},
): typeof import('@actual-app/api') {
  const asyncNoop = jest.fn(async () => Promise.resolve());
  return {
    init: asyncNoop,
    downloadBudget: asyncNoop,
    shutdown: asyncNoop,
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
    ...overrides,
  } as unknown as typeof import('@actual-app/api');
}

function makeService(
  dataDir: string,
  client: typeof import('@actual-app/api') = makeClient(),
): ActualApiService {
  return new ActualApiService(
    client,
    fs,
    dataDir,
    'http://example.com',
    'pw',
    'budget',
    '',
    true,
  );
}

describe('ActualApiService dataDir lock', () => {
  test('prevents concurrent runs from sharing the same dataDir', async () => {
    const dataDir = makeTmpDir();

    const s1 = makeService(dataDir);
    const s2 = makeService(dataDir);

    await s1.initializeApi();

    await expect(s2.initializeApi()).rejects.toThrow(/Refusing to use shared dataDir/i);

    await s1.shutdownApi();

    // After the first run releases the lock, the second should be able to initialize.
    await expect(s2.initializeApi()).resolves.toBeUndefined();
    await s2.shutdownApi();
  });

  test('releases the lock when the Actual client fails to initialize', async () => {
    const dataDir = makeTmpDir();
    const failing = makeService(dataDir, makeClient({
      init: jest.fn(async () => Promise.reject(new Error('Authentication failed: network-failure'))),
    }));

    await expect(failing.initializeApi()).rejects.toThrow(/Authentication failed/i);
    expect(fs.existsSync(lockPath(dataDir))).toBe(false);

    // A later run in the same process must not be blocked by the failed one.
    const next = makeService(dataDir);
    await expect(next.initializeApi()).resolves.toBeUndefined();
    await next.shutdownApi();
  });

  test('reclaims a lock left behind by this same process', async () => {
    const dataDir = makeTmpDir();
    writeLock(dataDir, {
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    });

    const service = makeService(dataDir);
    await expect(service.initializeApi()).resolves.toBeUndefined();
    await service.shutdownApi();
  });

  test('reclaims a lock whose heartbeat went stale even if the pid is alive', async () => {
    const dataDir = makeTmpDir();
    writeLock(dataDir, {
      // A live PID that is not ours: the parent process, or ours + 1 as a stand-in for PID reuse.
      pid: 1,
      hostname: os.hostname(),
      startedAt: new Date(Date.now() - LOCK_STALE_MS * 3).toISOString(),
      heartbeatAt: new Date(Date.now() - LOCK_STALE_MS * 3).toISOString(),
    });

    const service = makeService(dataDir);
    await expect(service.initializeApi()).resolves.toBeUndefined();
    await service.shutdownApi();
  });

  test('reclaims a lock written by a different host', async () => {
    const dataDir = makeTmpDir();
    writeLock(dataDir, {
      pid: 1,
      hostname: `${os.hostname()}-other-container`,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    });

    const service = makeService(dataDir);
    await expect(service.initializeApi()).resolves.toBeUndefined();
    await service.shutdownApi();
  });

  test('still refuses a fresh lock held by another live process', async () => {
    const dataDir = makeTmpDir();
    writeLock(dataDir, {
      pid: 1,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
    });

    const service = makeService(dataDir);
    await expect(service.initializeApi()).rejects.toThrow(/Refusing to use shared dataDir/i);
  });
});
