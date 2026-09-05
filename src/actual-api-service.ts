import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/core/src/server/api-models';
import { TransactionEntity, RuleEntity } from '@actual-app/core/src/types/models';
import { ActualApiServiceI } from './types';
import DataDirLock from './utils/data-dir-lock';

class ActualApiService implements ActualApiServiceI {
  private actualApiClient: typeof import('@actual-app/api');

  private readonly dataDir: string;

  private readonly serverURL: string;

  private readonly password: string;

  private readonly budgetId: string;

  private readonly e2ePassword: string;

  private readonly isDryRun: boolean;

  private readonly dataDirLock: DataDirLock;

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
    this.dataDir = dataDir;
    this.serverURL = serverURL;
    this.password = password;
    this.budgetId = budgetId;
    this.e2ePassword = e2ePassword;
    this.isDryRun = isDryRun;
    this.dataDirLock = new DataDirLock(fs, dataDir);
  }

  public async initializeApi() {
    this.dataDirLock.acquire();

    try {
      await this.actualApiClient.init({
        dataDir: this.dataDir,
        serverURL: this.serverURL,
        password: this.password,
      });
    } catch (error: unknown) {
      // Never leave the lock behind: the next scheduled run would otherwise find a lock
      // owned by this still-running process and refuse to start forever.
      this.dataDirLock.release();
      throw error;
    }

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
      this.dataDirLock.release();

      throw new Error(`Budget download failed. Verify that:
1. Budget ID "${this.budgetId}" is correct
2. Server URL "${this.serverURL}" is reachable
3. Password is correct
4. E2E password (if used) is valid`);
    }
  }

  public async shutdownApi() {
    try {
      await this.actualApiClient.shutdown();
    } finally {
      this.dataDirLock.release();
    }
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

  public async runBankSync(): Promise<void> {
    if (this.isDryRun) {
      console.log('DRY RUN: Would run bank sync');
      return;
    }
    await this.actualApiClient.runBankSync();
  }

  public async createCategory(name: string, groupId: string): Promise<string> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would create category name: ${name} groupId: ${groupId}`);
      return 'dry run';
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.actualApiClient.createCategory({
      name,
      group_id: groupId,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  public async createCategoryGroup(name: string): Promise<string> {
    if (this.isDryRun) {
      console.log(`DRY RUN: Would create category group: ${name}`);
      return 'dry run';
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
