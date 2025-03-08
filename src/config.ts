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
export const groqApiKey = process.env.GROQ_API_KEY ?? '';
export const groqModel = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
export const groqBaseURL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1';
export const valueSerpApiKey = process.env.VALUESERP_API_KEY ?? '';

// Feature Flags System
export interface FeatureFlag {
  enabled: boolean;
  defaultValue: boolean;
  description: string;
  options?: string[];
}

export type FeatureFlags = Record<string, FeatureFlag>;

export const features: FeatureFlags = {};

let enabledFeatures: string[] = [];
try {
  if (process.env.FEATURES) {
    const parsedFeatures = JSON.parse(process.env.FEATURES) as unknown;
    if (Array.isArray(parsedFeatures)) {
      enabledFeatures = parsedFeatures as string[];
    } else {
      console.warn('FEATURES environment variable is not a valid JSON array, ignoring');
    }
  }
} catch (e) {
  console.warn('Failed to parse FEATURES environment variable, ignoring', e);
}

// Register standard features with defaults
function registerStandardFeatures() {
  // Suggest new categories (disabled by default)
  features.suggestNewCategories = {
    enabled: enabledFeatures.includes('suggestNewCategories'),
    defaultValue: false,
    description: 'Suggest new categories for transactions that cannot be classified',
  };

  // Dry run mode (enabled by default)
  features.dryRun = {
    enabled: enabledFeatures.includes('dryRun'),
    defaultValue: true,
    description: 'Run in dry mode without actually making changes',
  };

  // Dry run for new categories (enabled by default)
  features.dryRunNewCategories = {
    enabled: enabledFeatures.includes('dryRunNewCategories'),
    defaultValue: true,
    description: 'Only log suggested categories without creating them',
  };

  // Rerun missed transactions (disabled by default)
  features.rerunMissedTransactions = {
    enabled: enabledFeatures.includes('rerunMissedTransactions'),
    defaultValue: false,
    description: 'Re-process transactions marked as not guessed',
  };
}

// Register available tools as features
function registerToolFeatures() {
  // Parse tools from ENABLED_TOOLS for backward compatibility
  const legacyTools = (process.env.ENABLED_TOOLS ?? '').split(',')
    .map((tool) => tool.trim())
    .filter(Boolean);

  // Register webSearch tool
  features.webSearch = {
    enabled: enabledFeatures.includes('webSearch') || legacyTools.includes('webSearch'),
    defaultValue: false,
    description: 'Enable web search capability for merchant lookup',
    options: ['webSearch'],
  };

  // Additional tools can be added here following the same pattern
  // features.newTool = {
  //   enabled: enabledFeatures.includes('newTool'),
  //   defaultValue: false,
  //   description: '...'
  // };
}

registerStandardFeatures();
registerToolFeatures();

export function isFeatureEnabled(featureName: string): boolean {
  return features[featureName]?.enabled ?? features[featureName]?.defaultValue ?? false;
}

export function registerCustomFeatureFlag(
  name: string,
  enabled: boolean,
  defaultValue: boolean,
  description: string,
  options?: string[],
): void {
  features[name] = {
    enabled,
    defaultValue,
    description,
    options,
  };
}

export function toggleFeature(featureName: string, enabled?: boolean): boolean {
  if (!features[featureName]) {
    console.warn(`Feature flag '${featureName}' does not exist`);
    return false;
  }
  const newValue = enabled ?? !features[featureName].enabled;
  features[featureName].enabled = newValue;
  return newValue;
}

export function getEnabledTools(): string[] {
  return Object.entries(features)
    .filter(([_, config]) => config.options && isFeatureEnabled(config.options[0]))
    .flatMap(([_, config]) => config.options ?? []);
}

export function isToolEnabled(toolName: string): boolean {
  return getEnabledTools().includes(toolName);
}
