import { ActualAiServiceI, ActualApiServiceI, TransactionServiceI } from './types';
import suppressConsoleLogsAsync from './utils';

class ActualAiService implements ActualAiServiceI {
  private readonly transactionService: TransactionServiceI;

  private readonly actualApiService: ActualApiServiceI;

  private readonly syncAccountsBeforeClassify: boolean;

  constructor(
    transactionService: TransactionServiceI,
    actualApiService: ActualApiServiceI,
    syncAccountsBeforeClassify: boolean,
  ) {
    this.transactionService = transactionService;
    this.actualApiService = actualApiService;
    this.syncAccountsBeforeClassify = syncAccountsBeforeClassify;
  }

  public async classify() {
    console.log('Starting classification process');
    try {
      await this.actualApiService.initializeApi();
      if (this.syncAccountsBeforeClassify) {
        await this.syncAccounts();
      }
      await this.transactionService.migrateToTags();
      await this.transactionService.processTransactions();
      await this.actualApiService.shutdownApi();
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  async syncAccounts(): Promise<void> {
    console.log('Syncing bank accounts');
    try {
      await suppressConsoleLogsAsync(async () => this.actualApiService.runBankSync());
      console.log('Bank accounts synced');
    } catch (error) {
      console.error('Error syncing bank accounts:', error);
    }
  }
}

export default ActualAiService;
