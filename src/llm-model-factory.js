const { openai } = require('@ai-sdk/openai');
const { anthropic } = require('@ai-sdk/anthropic');
const { google } = require('@ai-sdk/google');
const { ollama } = require('ollama-ai-provider');
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
} = require('./config');

const create = () => {
  console.debug(`Creating model for provider: ${llmProvider}`);
  switch (llmProvider) {
    case 'openai':
      return openai(openaiModel, { baseURL: openaiBaseURL, apiKey: openaiApiKey });
    case 'anthropic':
      return anthropic(anthropicModel, { baseURL: anthropicBaseURL, apiKey: anthropicApiKey });
    case 'google':
      return google(googleModel, { baseURL: googleBaseURL, apiKey: googleApiKey });
    case 'ollama':
      return ollama(ollamaModel, { baseURL: ollamaBaseURL });
    default:
      throw new Error(`Unknown provider: ${llmProvider}`);
  }
};

module.exports = {
  create,
};
