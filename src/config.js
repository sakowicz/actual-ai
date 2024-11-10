require('dotenv').config();

module.exports = {
  serverURL: process.env.ACTUAL_SERVER_URL,
  password: process.env.ACTUAL_PASSWORD,
  budgetId: process.env.ACTUAL_BUDGET_ID,
  e2ePassword: process.env.ACTUAL_E2E_PASSWORD,
  cronSchedule: process.env.CLASSIFICATION_SCHEDULE_CRON,
  classifyOnStartup: process.env.CLASSIFY_ON_STARTUP === 'true',
  syncAccountsBeforeClassify: process.env.SYNC_ACCOUNTS_BEFORE_CLASSIFY === 'true',
  llmProvider: process.env.LLM_PROVIDER || 'openai',
  openaiBaseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
  googleModel: process.env.GOOGLE_GENERATIVE_MODEL || 'gemini-1.5-flash',
  googleBaseURL: process.env.GOOGLE_GENERATIVE_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ollamaBaseURL: process.env.OLLAMA_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL || 'phi3.5',
};
