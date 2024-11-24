interface ActualApiServiceParams {
  actualApiClient: typeof import('@actual-app/api');
  fs: typeof import('fs');
  dataDir: string;
  serverURL: string;
  password: string;
  budgetId: string;
  e2ePassword: string;
}

class ActualApiService {
  private actualApiClient: typeof import('@actual-app/api');

  private fs: typeof import('fs');

  private dataDir: string;

  private serverURL: string;

  private password: string;

  private budgetId: string;

  private e2ePassword: string;

  constructor(params: ActualApiServiceParams) {
    this.actualApiClient = params.actualApiClient;
    this.fs = params.fs;
    this.dataDir = params.dataDir;
    this.serverURL = params.serverURL;
    this.password = params.password;
    this.budgetId = params.budgetId;
    this.e2ePassword = params.e2ePassword;
  }

  async initializeApi() {
    if (!this.fs.existsSync(this.dataDir)) {
      this.fs.mkdirSync(this.dataDir);
    }

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
    } catch (error: any) {
      console.error('Failed to download budget:', error.message);
      throw new Error('Budget download failed');
    }
  }

  async shutdownApi() {
    await this.actualApiClient.shutdown();
  }
}

export default ActualApiService;
