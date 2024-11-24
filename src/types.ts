export interface LlmModelFactory {
  create(): any;
}

export interface Ai {
  // eslint-disable-next-line no-unused-vars
  generateText(options: { model: any; prompt: string; temperature: number; max_tokens: number })
    : Promise<{ text: string }>;
}

export interface TransactionServiceParams {
  actualApiClient: typeof import('@actual-app/api');
  llmModelFactory: LlmModelFactory;
  ai: Ai;
}

export interface LlmModelFactoryParams {
  openai: any;
  anthropic: any;
  google: any;
  ollama: any;
  llmProvider: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseURL: string;
  anthropicBaseURL: string;
  anthropicApiKey: string;
  anthropicModel: string;
  googleModel: string;
  googleBaseURL: string;
  googleApiKey: string;
  ollamaModel: string;
  ollamaBaseURL: string;
}
