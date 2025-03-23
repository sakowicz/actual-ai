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
  getEnabledTools,
} from './config';
import ActualAiService from './actual-ai';
import PromptGenerator from './prompt-generator';
import LlmService from './llm-service';
import ToolService from './utils/tool-service';

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

const transactionService = new TransactionService(
  actualApiService,
  llmService,
  promptGenerator,
  notGuessedTag,
  guessedTag,
);

const actualAi = new ActualAiService(
  transactionService,
  actualApiService,
);

export default actualAi;
