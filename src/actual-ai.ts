import { ActualAiServiceI, ActualApiServiceI, TransactionServiceI } from './types';
import suppressConsoleLogsAsync from './utils';
import { formatError } from './utils/error-utils';

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
        console.error(
          'Bank sync failed, continuing with existing transactions:',
          formatError(error),
        );
      }

      // These should run even if sync failed
      await this.transactionService.migrateToTags();

      try {
        await this.transactionService.processTransactions();
      } catch (error) {
        if (this.isRateLimitError(error)) {
          console.error('Rate limit reached during transaction processing. Consider:');
          console.error('1. Adjusting rate limits in provider-limits.ts');
          console.error('2. Switching to a provider with higher limits');
          console.error('3. Breaking your processing into smaller batches');
        } else {
          console.error(
            'An error occurred during transaction processing:',
            formatError(error),
          );
        }
      }
    } catch (error) {
      console.error(
        'An error occurred:',
        formatError(error),
      );
    } finally {
      try {
        await this.actualApiService.shutdownApi();
      } catch (shutdownError) {
        console.error('Error during API shutdown:', formatError(shutdownError));
      }
    }
  }

  async syncAccounts(): Promise<void> {
    console.log('Syncing bank accounts');
    try {
      await suppressConsoleLogsAsync(async () => this.actualApiService.runBankSync());
      console.log('Bank accounts synced');
    } catch (error) {
      console.error(
        'Error syncing bank accounts:',
        formatError(error),
      );
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (!error) return false;

    const errorStr = formatError(error);
    return errorStr.includes('Rate limit')
           || errorStr.includes('rate limited')
           || errorStr.includes('rate_limit_exceeded')
           || (error instanceof Error
            && 'statusCode' in error
            && (error as unknown as { statusCode: number }).statusCode === 429);
  }
}

export default ActualAiService;
