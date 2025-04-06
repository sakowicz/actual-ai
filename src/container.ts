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
  llmProvider,
  notGuessedTag,
  ollamaBaseURL,
  ollamaModel,
  openaiApiKey,
  openaiBaseURL,
  openaiModel,
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
import RuleMatchHandler from './transaction/rule-match-handler';
import ExistingCategoryHandler from './transaction/existing-category-handler';

// Create tool service if API key is available and tools are enabled
const toolService = valueSerpApiKey && getEnabledTools().length > 0
  ? new ToolService(valueSerpApiKey)
  : undefined;

const llmModelFactory = new LlmModelFactory(
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
);

const promptGenerator = new PromptGenerator(
  promptTemplate,
);

const llmService = new LlmService(
  llmModelFactory,
  toolService,
);

const tagService = new TagService(notGuessedTag, guessedTag);

const ruleMatchHandler = new RuleMatchHandler(actualApiService, guessedTag, tagService);
const existingCategoryHandler = new ExistingCategoryHandler(
  actualApiService,
  notGuessedTag,
  guessedTag,
  tagService,
);

const transactionService = new TransactionService(
  actualApiService,
  llmService,
  promptGenerator,
  new CategorySuggestionOptimizer(new SimilarityCalculator()),
  notGuessedTag,
  guessedTag,
  tagService,
  ruleMatchHandler,
  existingCategoryHandler,
);

const notesMigrator = new NotesMigrator(
  actualApiService,
  notGuessedTag,
  guessedTag,
  tagService,
);

const actualAi = new ActualAiService(
  transactionService,
  actualApiService,
  notesMigrator,
);

export default actualAi;
