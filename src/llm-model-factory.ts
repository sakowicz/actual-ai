import { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';
import { createGroq } from '@ai-sdk/groq';
import { LlmModelFactoryI } from './types';

class LlmModelFactory implements LlmModelFactoryI {
  private readonly llmProvider: string;

  private readonly openaiApiKey: string;

  private readonly openaiModel: string;

  private readonly openaiBaseURL: string;

  private readonly openrouterApiKey: string;

  private readonly openrouterModel: string;

  private readonly openrouterBaseURL: string;

  private readonly openrouterReferrer: string;

  private readonly openrouterTitle: string;

  private readonly anthropicBaseURL: string;

  private readonly anthropicApiKey: string;

  private readonly anthropicModel: string;

  private readonly googleModel: string;

  private readonly googleBaseURL: string;

  private readonly googleApiKey: string;

  private readonly ollamaModel: string;

  private readonly ollamaBaseURL: string;

  private readonly groqApiKey: string;

  private readonly groqModel: string;

  private readonly groqBaseURL: string;

  constructor(
    llmProvider: string,
    openaiApiKey: string,
    openaiModel: string,
    openaiBaseURL: string,
    openrouterApiKey: string,
    openrouterModel: string,
    openrouterBaseURL: string,
    openrouterReferrer: string,
    openrouterTitle: string,
    anthropicBaseURL: string,
    anthropicApiKey: string,
    anthropicModel: string,
    googleModel: string,
    googleBaseURL: string,
    googleApiKey: string,
    ollamaModel: string,
    ollamaBaseURL: string,
    groqApiKey: string,
    groqModel: string,
    groqBaseURL: string,
  ) {
    this.llmProvider = llmProvider;
    this.openaiApiKey = openaiApiKey;
    this.openaiModel = openaiModel;
    this.openaiBaseURL = openaiBaseURL;
    this.openrouterApiKey = openrouterApiKey;
    this.openrouterModel = openrouterModel;
    this.openrouterBaseURL = openrouterBaseURL;
    this.openrouterReferrer = openrouterReferrer;
    this.openrouterTitle = openrouterTitle;
    this.anthropicBaseURL = anthropicBaseURL;
    this.anthropicApiKey = anthropicApiKey;
    this.anthropicModel = anthropicModel;
    this.googleModel = googleModel;
    this.googleBaseURL = googleBaseURL;
    this.googleApiKey = googleApiKey;
    this.ollamaModel = ollamaModel;
    this.ollamaBaseURL = ollamaBaseURL;
    this.groqApiKey = groqApiKey;
    this.groqModel = groqModel;
    this.groqBaseURL = groqBaseURL;
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
      case 'openrouter': {
        const headers: Record<string, string> = {};
        if (this.openrouterReferrer) headers['HTTP-Referer'] = this.openrouterReferrer;
        if (this.openrouterTitle) headers['X-Title'] = this.openrouterTitle;

        const openrouter = createOpenAI({
          name: 'openrouter',
          baseURL: this.openrouterBaseURL,
          apiKey: this.openrouterApiKey,
          headers,
        });
        return openrouter(this.openrouterModel);
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
      case 'groq': {
        const groq = createGroq({
          baseURL: this.groqBaseURL,
          apiKey: this.groqApiKey,
        });
        return groq(this.groqModel) as unknown as LanguageModel;
      }
      default:
        throw new Error(`Unknown provider: ${this.llmProvider}`);
    }
  }

  public isFallbackMode(): boolean {
    return this.llmProvider === 'ollama';
  }

  public getProvider(): string {
    return this.llmProvider;
  }

  public getModelProvider(): string {
    return this.llmProvider;
  }
}

export default LlmModelFactory;
