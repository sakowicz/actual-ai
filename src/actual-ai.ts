import { ActualAiServiceI, ActualApiServiceI, TransactionServiceI } from './types';

class ActualAiService implements ActualAiServiceI {
  private readonly transactionService: TransactionServiceI;

  private readonly actualApiService: ActualApiServiceI;

  constructor(
    transactionService: TransactionServiceI,
    actualApiService: ActualApiServiceI,
  ) {
    this.transactionService = transactionService;
    this.actualApiService = actualApiService;
  }

  public async classify() {
    console.log('Starting classification process');
    try {
      await this.actualApiService.initializeApi();
      await this.transactionService.processTransactions();
      await this.actualApiService.shutdownApi();
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }
}

export default ActualAiService;
