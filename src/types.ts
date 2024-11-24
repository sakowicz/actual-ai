import { GenerateTextResult, CoreTool, LanguageModel } from 'ai';

export interface LlmModelFactoryI {
  create(): LanguageModel;
}

export interface ActualApiServiceI {
  initializeApi(): Promise<void>;
  shutdownApi(): Promise<void>;
}

export interface TransactionServiceI {
  processTransactions(): Promise<void>;
}

export interface ActualAiServiceI {
  classify(): Promise<void>;
}

// eslint-disable-next-line no-unused-vars
export type GenerateTextFunction = (options: {
  model: LanguageModel;
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
}) => Promise<GenerateTextResult<Record<string, CoreTool>>>;
