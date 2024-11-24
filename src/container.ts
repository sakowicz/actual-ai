import * as actualApiClient from '@actual-app/api';
import fs from 'fs';
import ai from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { ollama } from 'ollama-ai-provider';
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

const llmModelFactory = new LlmModelFactory({
  openai,
  anthropic,
  google,
  ollama,
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
});

const actualApiService = new ActualApiService({
  actualApiClient,
  fs,
  dataDir,
  serverURL,
  password,
  budgetId,
  e2ePassword,
});
const transactionService = new TransactionService({
  actualApiClient, ai, llmModelFactory,
});

const actualAi = new ActualAiService({ transactionService, actualApiService });

export default actualAi;
