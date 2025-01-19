import { LanguageModel } from 'ai';
import {
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';

export interface LlmModelFactoryI {
  create(): LanguageModel;
}

export interface ActualApiServiceI {
  initializeApi(): Promise<void>;

  shutdownApi(): Promise<void>;

  getCategoryGroups(): Promise<APICategoryGroupEntity[]>

  getCategories(): Promise<(APICategoryEntity | APICategoryGroupEntity)[]>

  getPayees(): Promise<APIPayeeEntity[]>

  getTransactions(): Promise<TransactionEntity[]>

  updateTransactionNotes(id: string, notes: string): Promise<void>

  updateTransactionNotesAndCategory(
    id: string,
    notes: string,
    categoryId: string,
  ): Promise<void>

  runBankSync(): Promise<void>
}

export interface TransactionServiceI {
  processTransactions(): Promise<void>;

  migrateToTags(): Promise<void>;
}

export interface ActualAiServiceI {
  classify(): Promise<void>;
}

export interface LlmServiceI {
  ask(prompt: string, categoryIds: string[]): Promise<string>;
}

export interface PromptGeneratorI {
  generate(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string
}
