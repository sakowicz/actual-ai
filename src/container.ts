import * as actualApiClient from '@actual-app/api';
import fs from 'fs';
import ActualApiService from './actual-api-service';
import TransactionService from './transaction-service';
import LlmModelFactory from './llm-model-factory';
import {
  anthropicApiKey,
  anthropicBaseURL,
  anthropicModel,
  budgetId,
  dataDir,
  e2ePassword,
  getEnabledTools,
  googleApiKey,
  googleBaseURL,
  googleModel,
  groqApiKey,
  groqBaseURL,
  groqModel,
  guessedTag,
  isFeatureEnabled,
  llmProvider,
  notGuessedTag,
  ollamaBaseURL,
  ollamaModel,
  openaiApiKey,
  openaiBaseURL,
  openaiModel,
  openrouterApiKey,
  openrouterBaseURL,
  openrouterModel,
  openrouterReferrer,
  openrouterTitle,
  password,
  promptTemplate,
  serverURL,
  valueSerpApiKey,
} from './config';
import ActualAiService from './actual-ai';
import PromptGenerator from './prompt-generator';
import LlmService from './llm-service';
import ToolService from './utils/tool-service';
import SimilarityCalculator from './similarity-calculator';
import CategorySuggestionOptimizer from './category-suggestion-optimizer';
import NotesMigrator from './transaction/notes-migrator';
import TagService from './transaction/tag-service';
import RuleMatchStrategy from './transaction/processing-strategy/rule-match-strategy';
import ExistingCategoryStrategy from './transaction/processing-strategy/existing-category-strategy';
import NewCategoryStrategy from './transaction/processing-strategy/new-category-strategy';
import CategorySuggester from './transaction/category-suggester';
import BatchTransactionProcessor from './transaction/batch-transaction-processor';
import TransactionProcessor from './transaction/transaction-processor';
import TransactionFilterer from './transaction/transaction-filterer';
import RateLimiter from './utils/rate-limiter';

// Create tool service if API key is available and tools are enabled
export function createToolService(): ToolService | undefined {
  // freeWebSearch does not require ValueSerp; only the paid `webSearch` does.
  return getEnabledTools().length > 0 ? new ToolService(valueSerpApiKey) : undefined;
}

const toolService = createToolService();

const isDryRun = isFeatureEnabled('dryRun');

const llmModelFactory = new LlmModelFactory(
  llmProvider,
  openaiApiKey,
  openaiModel,
  openaiBaseURL,
  openrouterApiKey,
  openrouterModel,
  openrouterBaseURL,
  openrouterReferrer,
  openrouterTitle,
  anthropicBaseURL,
  anthropicApiKey,
  anthropicModel,
  googleModel,
  googleBaseURL,
  googleApiKey,
  ollamaModel,
  ollamaBaseURL,
  groqApiKey,
  groqModel,
  groqBaseURL,
);

const actualApiService = new ActualApiService(
  actualApiClient,
  fs,
  dataDir,
  serverURL,
  password,
  budgetId,
  e2ePassword,
  isDryRun,
);

const promptGenerator = new PromptGenerator(
  promptTemplate,
);

const llmService = new LlmService(
  llmModelFactory,
  new RateLimiter(true),
  isFeatureEnabled('disableRateLimiter'),
  toolService,
);

const tagService = new TagService(notGuessedTag, guessedTag);

const ruleMatchStrategy = new RuleMatchStrategy(actualApiService, tagService);
const existingCategoryStrategy = new ExistingCategoryStrategy(
  actualApiService,
  tagService,
);

const categorySuggester = new CategorySuggester(
  actualApiService,
  new CategorySuggestionOptimizer(new SimilarityCalculator()),
  tagService,
);

const newCategoryStrategy = new NewCategoryStrategy();

const transactionProcessor = new TransactionProcessor(
  actualApiService,
  llmService,
  promptGenerator,
  tagService,
  [ruleMatchStrategy, existingCategoryStrategy, newCategoryStrategy],
);

const batchTransactionProcessor = new BatchTransactionProcessor(
  transactionProcessor,
  20,
);

const transactionFilterer = new TransactionFilterer(tagService);

const transactionService = new TransactionService(
  actualApiService,
  categorySuggester,
  batchTransactionProcessor,
  transactionFilterer,
  isDryRun,
);

const notesMigrator = new NotesMigrator(
  actualApiService,
  tagService,
);

const actualAi = new ActualAiService(
  transactionService,
  actualApiService,
  notesMigrator,
);

export default actualAi;
