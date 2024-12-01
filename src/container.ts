import * as actualApiClient from '@actual-app/api';
import fs from 'fs';
import { generateText } from 'ai';
import ActualApiService from './actual-api-service';
import TransactionService from './transaction-service';
import LlmModelFactory from './llm-model-factory';
import {
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
  dataDir,
  serverURL,
  password,
  budgetId,
  e2ePassword,
  syncAccountsBeforeClassify,
} from './config';
import ActualAiService from './actual-ai';
import PromptGenerator from './prompt-generator';
import LlmService from './llm-service';

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

const llmService = new LlmService(
  generateText,
  llmModelFactory,
);

const transactionService = new TransactionService(
  actualApiService,
  llmService,
  new PromptGenerator(),
  syncAccountsBeforeClassify,
);

const actualAi = new ActualAiService(
  transactionService,
  actualApiService,
);

export default actualAi;
