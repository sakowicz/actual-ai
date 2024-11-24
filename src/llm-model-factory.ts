import { LanguageModel } from 'ai';
import { LlmModelFactoryI } from './types';

class LlmModelFactory implements LlmModelFactoryI {
  private openai: any;

  private anthropic: any;

  private google: any;

  private ollama: any;

  private llmProvider: string;

  private openaiApiKey: string;

  private openaiModel: string;

  private openaiBaseURL: string;

  private anthropicBaseURL: string;

  private anthropicApiKey: string;

  private anthropicModel: string;

  private googleModel: string;

  private googleBaseURL: string;

  private googleApiKey: string;

  private ollamaModel: string;

  private ollamaBaseURL: string;

  constructor(
    openai: any,
    anthropic: any,
    google: any,
    ollama: any,
    llmProvider: string,
    openaiApiKey: string,
    openaiModel: string,
    openaiBaseURL: string,
    anthropicBaseURL: string,
    anthropicApiKey: string,
    anthropicModel: string,
    googleModel: string,
    googleBaseURL: string,
    googleApiKey: string,
    ollamaModel: string,
    ollamaBaseURL: string,
  ) {
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

  public create(): LanguageModel {
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

export default LlmModelFactory;
