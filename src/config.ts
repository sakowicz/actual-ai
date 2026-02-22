import dotenv from 'dotenv';
import fs from 'fs';

const defaultPromptTemplate = fs.readFileSync('./src/templates/prompt.hbs', 'utf8').trim();

dotenv.config();

export const serverURL = process.env.ACTUAL_SERVER_URL ?? '';
export const password = process.env.ACTUAL_PASSWORD ?? '';
export const budgetId = process.env.ACTUAL_BUDGET_ID ?? '';
export const e2ePassword = process.env.ACTUAL_E2E_PASSWORD ?? '';
export const cronSchedule = process.env.CLASSIFICATION_SCHEDULE_CRON ?? '';
export const openrouterApiKey = process.env.OPENROUTER_API_KEY ?? '';
export const llmProvider = process.env.LLM_PROVIDER ?? (openrouterApiKey ? 'openrouter' : 'openai');
export const openaiBaseURL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
export const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
export const openaiModel = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
export const openrouterBaseURL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
export const openrouterModel = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v3.2';
export const openrouterReferrer = process.env.OPENROUTER_REFERRER ?? process.env.OPENROUTER_REFERER ?? '';
export const openrouterTitle = process.env.OPENROUTER_TITLE ?? 'actual-ai';
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
  } else if (process.env.ENABLED_FEATURES) {
    const raw = process.env.ENABLED_FEATURES.trim();
    if (raw.startsWith('[')) {
      const parsedFeatures = JSON.parse(raw) as unknown;
      if (Array.isArray(parsedFeatures)) {
        enabledFeatures = parsedFeatures as string[];
      } else {
        console.warn('ENABLED_FEATURES must be a comma list or JSON array, ignoring');
      }
    } else {
      enabledFeatures = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
} catch (e) {
  console.warn('Failed to parse FEATURES/ENABLED_FEATURES environment variable, ignoring', e);
}

function registerStandardFeatures() {
  features.disableDuplicateFinding = {
    enabled: enabledFeatures.includes('disableDuplicateFinding'),
    defaultValue: false,
    description: 'Disable finding of duplicate transactions',
  };

  features.suggestNewCategories = {
    enabled: enabledFeatures.includes('suggestNewCategories'),
    defaultValue: false,
    description: 'Suggest new categories for transactions that cannot be classified',
  };

  features.dryRun = {
    enabled: enabledFeatures.includes('dryRun'),
    defaultValue: true,
    description: 'Run in dry mode without actually making changes',
  };

  features.rerunMissedTransactions = {
    enabled: enabledFeatures.includes('rerunMissedTransactions'),
    defaultValue: false,
    description: 'Re-process transactions marked as not guessed',
  };

  features.classifyOnStartup = {
    enabled: enabledFeatures.includes('classifyOnStartup') || process.env.CLASSIFY_ON_STARTUP === 'true',
    defaultValue: false,
    description: 'Run classification when the application starts',
  };

  features.syncAccountsBeforeClassify = {
    enabled: enabledFeatures.includes('syncAccountsBeforeClassify') || process.env.SYNC_ACCOUNTS_BEFORE_CLASSIFY === 'true',
    defaultValue: false,
    description: 'Sync accounts before running classification',
  };

  features.disableRateLimiter = {
    enabled: enabledFeatures.includes('disableRateLimiter'),
    defaultValue: false,
    description: 'Disable Rate Limiter',
  };

  features.prePromptWebSearch = {
    enabled: enabledFeatures.includes('prePromptWebSearch'),
    defaultValue: false,
    description: 'Perform a web search before sending the prompt to the LLM and append results to the prompt',
  };

  features.skipTransferLike = {
    enabled: enabledFeatures.includes('skipTransferLike'),
    defaultValue: false,
    description: 'Skip categorization for transactions that look like transfers/credit-card payments (to avoid false positives)',
  };

  features.omitRulesFromPrompt = {
    enabled: enabledFeatures.includes('omitRulesFromPrompt'),
    defaultValue: false,
    description: 'Do not include rule descriptions in the LLM prompt (reduces tokens and avoids rate limits)',
  };

  features.compactCategoryIds = {
    enabled: enabledFeatures.includes('compactCategoryIds'),
    defaultValue: false,
    description: 'Use short category codes in prompts to reduce token usage (codes are mapped back to IDs internally)',
  };

  features.historyCategoryGuessing = {
    enabled: enabledFeatures.includes('historyCategoryGuessing'),
    defaultValue: false,
    description: 'Try to categorize from past transactions with the same payee/imported payee before calling the LLM',
  };

  features.historyOnly = {
    enabled: enabledFeatures.includes('historyOnly'),
    defaultValue: false,
    description: 'Only categorize using history-based guessing; skip LLM categorization when no reliable history match exists',
  };
}

function registerToolFeatures() {
  const legacyTools = (process.env.ENABLED_TOOLS ?? '').split(',')
    .map((tool) => tool.trim())
    .filter(Boolean);

  features.webSearch = {
    enabled: enabledFeatures.includes('webSearch') || legacyTools.includes('webSearch'),
    defaultValue: false,
    description: 'Enable web search capability for merchant lookup',
    options: ['webSearch'],
  };

  features.freeWebSearch = {
    enabled: enabledFeatures.includes('freeWebSearch') || legacyTools.includes('freeWebSearch'),
    defaultValue: false,
    description: 'Enable free web search capability for merchant lookup (self-hosted alternative to ValueSerp)',
    options: ['freeWebSearch'],
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
