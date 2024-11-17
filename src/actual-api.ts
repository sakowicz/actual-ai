class ActualApiService {
  private api: any;

  private fs: any;

  private dataDir: string;

  private serverURL: string;

  private password: string;

  private budgetId: string;

  private e2ePassword?: string;

  constructor({
    actualApi,
    fs,
    dataDir,
    serverURL,
    password,
    budgetId,
    e2ePassword,
  }: {
    actualApi: any;
    fs: any;
    dataDir: string;
    serverURL: string;
    password: string;
    budgetId: string;
    e2ePassword?: string;
  }) {
    this.api = actualApi;
    this.fs = fs;
    this.dataDir = dataDir;
    this.serverURL = serverURL;
    this.password = password;
    this.budgetId = budgetId;
    this.e2ePassword = e2ePassword;
  }

  async initializeApi() {
    if (!this.fs.existsSync(this.dataDir)) {
      this.fs.mkdirSync(this.dataDir);
    }

    await this.api.init({
      dataDir: this.dataDir,
      serverURL: this.serverURL,
      password: this.password,
    });

    try {
      if (this.e2ePassword) {
        await this.api.downloadBudget(this.budgetId, {
          password: this.e2ePassword,
        });
      } else {
        await this.api.downloadBudget(this.budgetId);
      }
      console.log('Budget downloaded');
    } catch (error: any) {
      console.error('Failed to download budget:', error.message);
      throw new Error('Budget download failed');
    }
  }

  async shutdownApi() {
    await this.api.shutdown();
  }
}

module.exports = { ActualApiService };
