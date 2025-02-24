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

      try {
        if (this.syncAccountsBeforeClassify) {
          await this.syncAccounts();
        }
      } catch (error) {
        console.error('Bank sync failed, continuing with existing transactions:', error);
      }

      // These should run even if sync failed
      await this.transactionService.migrateToTags();
      await this.transactionService.processTransactions();
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      try {
        await this.actualApiService.shutdownApi();
      } catch (shutdownError) {
        console.error('Error during API shutdown:', shutdownError);
      }
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
