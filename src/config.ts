import dotenv from 'dotenv';
import fs from 'fs';

const defaultPromptTemplate = fs.readFileSync('./src/templates/prompt.hbs', 'utf8').trim();

dotenv.config();

export const serverURL = process.env.ACTUAL_SERVER_URL ?? '';
export const password = process.env.ACTUAL_PASSWORD ?? '';
export const budgetId = process.env.ACTUAL_BUDGET_ID ?? '';
export const e2ePassword = process.env.ACTUAL_E2E_PASSWORD ?? '';
export const cronSchedule = process.env.CLASSIFICATION_SCHEDULE_CRON ?? '';
export const classifyOnStartup = process.env.CLASSIFY_ON_STARTUP === 'true';
export const syncAccountsBeforeClassify = process.env.SYNC_ACCOUNTS_BEFORE_CLASSIFY === 'true';
export const llmProvider = process.env.LLM_PROVIDER ?? 'openai';
export const openaiBaseURL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
export const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
export const openaiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
export const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? '';
export const anthropicBaseURL = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1';
export const anthropicModel = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest';
export const googleModel = process.env.GOOGLE_GENERATIVE_AI_MODEL ?? process.env.GOOGLE_GENERATIVE_MODEL ?? 'gemini-1.5-flash';
export const googleBaseURL = process.env.GOOGLE_GENERATIVE_AI_BASE_URL ?? process.env.GOOGLE_GENERATIVE_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta';
export const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '';
export const ollamaBaseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api';
export const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3.1';
export const dataDir = '/tmp/actual-ai/';
export const promptTemplate = process.env.PROMPT_TEMPLATE ?? defaultPromptTemplate;
export const notGuessedTag = process.env.NOT_GUESSED_TAG ?? '#actual-ai-miss';
export const guessedTag = process.env.GUESSED_TAG ?? '#actual-ai';
