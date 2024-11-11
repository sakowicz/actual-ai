class LlmModelFactory {
  constructor({
    openai,
    anthropic,
    google,
    ollama,
    llmProvider,
    openaiApiKey,
    openaiModel,
    openaiBaseURL,
    anthropicBaseURL,
    anthropicApiKey,
    anthropicModel,
    googleModel,
    googleBaseURL,
    googleApiKey,
    ollamaModel,
    ollamaBaseURL,
  }) {
    this.openai = openai;
    this.anthropic = anthropic;
    this.google = google;
    this.ollama = ollama;
    this.llmProvider = llmProvider;
    this.openaiApiKey = openaiApiKey;
    this.openaiModel = openaiModel;
    this.openaiBaseURL = openaiBaseURL;
    this.anthropicBaseURL = anthropicBaseURL;
    this.anthropicApiKey = anthropicApiKey;
    this.anthropicModel = anthropicModel;
    this.googleModel = googleModel;
    this.googleBaseURL = googleBaseURL;
    this.googleApiKey = googleApiKey;
    this.ollamaModel = ollamaModel;
    this.ollamaBaseURL = ollamaBaseURL;
  }

  create() {
    console.debug(`Creating model for provider: ${this.llmProvider}`);
    switch (this.llmProvider) {
      case 'openai':
        return this.openai(this.openaiModel, {
          baseURL: this.openaiBaseURL,
          apiKey: this.openaiApiKey,
        });
      case 'anthropic':
        return this.anthropic(this.anthropicModel, {
          baseURL: this.anthropicBaseURL,
          apiKey: this.anthropicApiKey,
        });
      case 'google-generative-ai':
        return this.google(this.googleModel, {
          baseURL: this.googleBaseURL,
          apiKey: this.googleApiKey,
        });
      case 'ollama':
        return this.ollama(this.ollamaModel, { baseURL: this.ollamaBaseURL });
      default:
        throw new Error(`Unknown provider: ${this.llmProvider}`);
    }
  }
}

exports.LlmModelFactory = LlmModelFactory;
