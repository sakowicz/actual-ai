import { GenerateTextResult, CoreTool, LanguageModel } from 'ai';
import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';

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

export interface PromptGeneratorI {
  generate(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string
}

// eslint-disable-next-line no-unused-vars
export type GenerateTextFunction = (options: {
  model: LanguageModel;
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
}) => Promise<GenerateTextResult<Record<string, CoreTool>>>;
