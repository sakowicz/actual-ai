const actualApi = require('@actual-app/api');
const fs = require('fs');
const ai = require('ai');
const { openai } = require('@ai-sdk/openai');
const { anthropic } = require('@ai-sdk/anthropic');
const { google } = require('@ai-sdk/google');
const { ollama } = require('ollama-ai-provider');
const { ActualApiService } = require('./actual-api.ts');
const { TransactionService } = require('./transaction-service.ts');
const { LlmModelFactory } = require('./llm-model-factory.ts');
const {
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
} = require('./config.ts');
const { ActualAiService } = require('./actual-ai.ts');

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
const transactionService = new TransactionService({
  actualApi, ai, llmModelFactory,
});
const actualApiService = new ActualApiService({
  actualApi,
  fs,
  dataDir,
  serverURL,
  password,
  budgetId,
  e2ePassword,
});

exports.actualAi = new ActualAiService({ transactionService, actualApiService });
