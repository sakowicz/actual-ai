import * as actualApiClient from '@actual-app/api';
import fs from 'fs';
import { generateText } from 'ai';
import ActualApiService from './actual-api';
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
} from './config';
import ActualAiService from './actual-ai';

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
const transactionService = new TransactionService(
  actualApiClient,
  generateText,
  llmModelFactory,
);

const actualAi = new ActualAiService(
  transactionService,
  actualApiService,
);

export default actualAi;
