class ActualAi {
  constructor({ transactionService, actualApiService }) {
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

module.exports = { ActualAi };
