import { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';
import { LlmModelFactoryI } from './types';

class LlmModelFactory implements LlmModelFactoryI {
  private readonly llmProvider: string;

  private readonly openaiApiKey: string;

  private readonly openaiModel: string;

  private readonly openaiBaseURL: string;

  private readonly anthropicBaseURL: string;

  private readonly anthropicApiKey: string;

  private readonly anthropicModel: string;

  private readonly googleModel: string;

  private readonly googleBaseURL: string;

  private readonly googleApiKey: string;

  private readonly ollamaModel: string;

  private readonly ollamaBaseURL: string;

  constructor(
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
      case 'openai': {
        const openai = createOpenAI({
          baseURL: this.openaiBaseURL,
          apiKey: this.openaiApiKey,
        });
        return openai(this.openaiModel);
      }
      case 'anthropic': {
        const anthropic = createAnthropic({
          apiKey: this.anthropicApiKey,
          baseURL: this.anthropicBaseURL,
        });
        return anthropic(this.anthropicModel);
      }
      case 'google-generative-ai': {
        const google = createGoogleGenerativeAI({
          baseURL: this.googleBaseURL,
          apiKey: this.googleApiKey,
        });
        return google(this.googleModel);
      }
      case 'ollama': {
        const ollama = createOllama({
          baseURL: this.ollamaBaseURL,
        });
        return ollama(this.ollamaModel);
      }
      default:
        throw new Error(`Unknown provider: ${this.llmProvider}`);
    }
  }

  public isFallbackMode(): boolean {
    return this.llmProvider === 'ollama';
  }
}

export default LlmModelFactory;
