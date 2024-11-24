interface TransactionService {
  processTransactions(): Promise<void>;
}

interface ActualApiService {
  initializeApi(): Promise<void>;
  shutdownApi(): Promise<void>;
}

class ActualAiService {
  private transactionService: TransactionService;

  private actualApiService: ActualApiService;

  constructor(
    { transactionService, actualApiService }:
      { transactionService: TransactionService; actualApiService: ActualApiService },
  ) {
    this.transactionService = transactionService;
    this.actualApiService = actualApiService;
  }

  async classify() {
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
