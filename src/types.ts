import { LanguageModel } from 'ai';
import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';

export interface LlmModelI {
  ask(prompt: string, possibleAnswers: string[]): Promise<string>;
  askFreeform(prompt: string): Promise<string>;
}

export interface LlmModelFactoryI {
  create(): LanguageModel;
  getProvider(): string;
  isFallbackMode(): boolean;
  getModelProvider(): string;
}

export interface ActualApiServiceI {
  initializeApi(): Promise<void>;

  shutdownApi(): Promise<void>;

  getCategoryGroups(): Promise<APICategoryGroupEntity[]>

  getCategories(): Promise<(APICategoryEntity | APICategoryGroupEntity)[]>

  getAccounts(): Promise<APIAccountEntity[]>

  getPayees(): Promise<APIPayeeEntity[]>

  getTransactions(): Promise<TransactionEntity[]>

  updateTransactionNotes(id: string, notes: string): Promise<void>

  updateTransactionNotesAndCategory(
    id: string,
    notes: string,
    categoryId: string,
  ): Promise<void>

  runBankSync(): Promise<void>

  createCategory(name: string, groupId: string): Promise<string>
}

export interface TransactionServiceI {
  processTransactions(): Promise<void>;

  migrateToTags(): Promise<void>;
}

export interface ActualAiServiceI {
  classify(): Promise<void>;

  syncAccounts(): Promise<void>
}

export interface LlmServiceI {
  ask(prompt: string, possibleAnswers: string[]): Promise<string>;

  askForCategorySuggestion(
    prompt: string
  ): Promise<{ name: string, groupId: string } | null>
}

export interface PromptGeneratorI {
  generate(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string

  generateCategorySuggestion(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string
}
