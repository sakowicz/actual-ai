import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/src/server/api-models';
import path from 'path';
import { TransactionEntity, RuleEntity } from '@actual-app/api/@types/loot-core/src/types/models';
import { ActualApiServiceI } from './types';
import { formatError } from './utils/error-utils';

function isErrnoException(error: unknown): error is Error & { code?: string } {
  return error instanceof Error;
}

class ActualApiService implements ActualApiServiceI {
  private actualApiClient: typeof import('@actual-app/api');

  private fs: typeof import('fs');

  private readonly dataDir: string;

  private readonly serverURL: string;

  private readonly password: string;

  private readonly budgetId: string;

  private readonly e2ePassword: string;

  private readonly isDryRun: boolean;

  private lockFd: number | null = null;

  private readonly lockPath: string;

  constructor(
    actualApiClient: typeof import('@actual-app/api'),
    fs: typeof import('fs'),
    dataDir: string,
    serverURL: string,
    password: string,
    budgetId: string,
    e2ePassword: string,
    isDryRun: boolean,
  ) {
    this.actualApiClient = actualApiClient;
    this.fs = fs;
    this.dataDir = dataDir;
    this.serverURL = serverURL;
    this.password = password;
    this.budgetId = budgetId;
    this.e2ePassword = e2ePassword;
    this.isDryRun = isDryRun;
    this.lockPath = path.join(this.dataDir, '.actual-ai.lock');
  }

  private acquireDataDirLock() {
    // Prevent multiple concurrent runs from sharing the same dataDir. The underlying
    // Actual sqlite DB is not safe for concurrent writers and can end up "out-of-sync".
    if (!this.fs.existsSync(this.dataDir)) {
      this.fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (this.fs.existsSync(this.lockPath)) {
      try {
        const raw = this.fs.readFileSync(this.lockPath, 'utf8');
        const parsed = JSON.parse(raw) as { pid?: number; startedAt?: string };
        const pid = parsed?.pid;
        if (typeof pid === 'number') {
          try {
            process.kill(pid, 0);
            throw new Error(
              `Another actual-ai run appears active (pid=${pid}). `
              + `Refusing to use shared dataDir: ${this.dataDir}`,
            );
          } catch (error: unknown) {
            if (isErrnoException(error) && error.code === 'ESRCH') {
              // Stale lock from a crashed process; remove it.
              this.fs.unlinkSync(this.lockPath);
            } else if (error instanceof Error) {
              // process.kill threw, but it's not ESRCH; rethrow.
              throw error;
            }
          }
        } else {
          // Unparseable/stale lock; remove it.
          this.fs.unlinkSync(this.lockPath);
        }
      } catch (e) {
        // If anything goes wrong reading the lock, fail safe.
        throw e instanceof Error ? e : new Error('Failed to read dataDir lock');
      }
    }

    // 'wx' creates exclusively; throws if exists.
    this.lockFd = this.fs.openSync(this.lockPath, 'wx');
    this.fs.writeFileSync(
      this.lockFd,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
  }

  private releaseDataDirLock() {
    try {
      if (this.lockFd !== null) {
        this.fs.closeSync(this.lockFd);
        this.lockFd = null;
      }
      if (this.fs.existsSync(this.lockPath)) {
        this.fs.unlinkSync(this.lockPath);
      }
    } catch {
      // Best-effort cleanup.
    }
  }

  public async initializeApi() {
    this.acquireDataDirLock();

    await this.actualApiClient.init({
      dataDir: this.dataDir,
      serverURL: this.serverURL,
      password: this.password,
    });

    try {
      if (this.e2ePassword) {
        await this.actualApiClient.downloadBudget(this.budgetId, {
          password: this.e2ePassword,
        });
      } else {
        await this.actualApiClient.downloadBudget(this.budgetId);
      }
      console.log('Budget downloaded');
    } catch (error: unknown) {
      let errorMessage = 'Failed to download budget';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        if ('status' in error && typeof error.status === 'number') {
          errorMessage += ` (HTTP ${error.status})`;
        }
      }
      console.error(errorMessage);
      console.error('Full error details:', error);

      await this.actualApiClient.shutdown();
      this.releaseDataDirLock();

      throw new Error(`Budget download failed. Verify that:
1. Budget ID "${this.budgetId}" is correct
2. Server URL "${this.serverURL}" is reachable
3. Password is correct
4. E2E password (if used) is valid`);
    }
  }

  public async shutdownApi() {
    await this.actualApiClient.shutdown();
    this.releaseDataDirLock();
  }

  public async getCategoryGroups(): Promise<APICategoryGroupEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.actualApiClient.getCategoryGroups();
  }

  public async getCategories(): Promise<(APICategoryEntity | APICategoryGroupEntity)[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.actualApiClient.getCategories();
  }

  public async getPayees(): Promise<APIPayeeEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.actualApiClient.getPayees();
  }

  public async getAccounts(): Promise<APIAccountEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.actualApiClient.getAccounts();
  }

  public async getTransactions(): Promise<TransactionEntity[]> {
    let transactions: TransactionEntity[] = [];
    const accounts = await this.getAccounts();
    // eslint-disable-next-line no-restricted-syntax
    for (const account of accounts) {
      transactions = transactions.concat(
        await this.actualApiClient.getTransactions(account.id, '1990-01-01', '2030-01-01'),
      );
    }
    return transactions;
  }

  public async getRules(): Promise<RuleEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.actualApiClient.getRules();
  }

  public async getPayeeRules(payeeId: string): Promise<RuleEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.actualApiClient.getPayeeRules(payeeId);
  }

  public async createRule(rule: Omit<RuleEntity, 'id'>): Promise<string> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would create rule: ${JSON.stringify(rule)}`);
      return 'dry run';
    }
    const result = await this.actualApiClient.createRule(rule);
    return result.id;
  }

  public async updateTransactionNotes(id: string, notes: string): Promise<void> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would update transaction notes of ${id} to: ${notes}`);
      return;
    }
    await this.actualApiClient.updateTransaction(id, { notes });
  }

  public async updateTransactionNotesAndCategory(
    id: string,
    notes: string,
    categoryId: string,
  ): Promise<void> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would update transaction notes ${id} to: ${notes} and category to ${categoryId}`);
      return;
    }
    await this.actualApiClient.updateTransaction(id, { notes, category: categoryId });
  }

  public async updateTransaction(
    id: string,
    updates: Partial<TransactionEntity>,
  ): Promise<void> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would update transaction ${id} with: ${JSON.stringify(updates)}`);
      return;
    }

    try {
      await this.actualApiClient.updateTransaction(id, updates);
    } catch (error) {
      console.error(`Error updating transaction ${id}:`, formatError(error));
    }
  }

  public async runBankSync(): Promise<void> {
    await this.actualApiClient.runBankSync();
  }

  public async createCategory(name: string, groupId: string): Promise<string> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would create category name: ${name} groupId: ${groupId}`);
      return 'dry run';
    }
    const result = await this.actualApiClient.createCategory({
      name,
      group_id: groupId,
    });

    return result;
  }

  public async createCategoryGroup(name: string): Promise<string> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would create category group: ${name}`);
      return 'dry run';
    }
    return this.actualApiClient.createCategoryGroup({
      name,
    });
  }

  public async updateCategoryGroup(id: string, name: string): Promise<void> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would update category group name: ${name} groupId: ${id}`);
      return;
    }
    await this.actualApiClient.updateCategoryGroup(id, { name });
  }
}

export default ActualApiService;
