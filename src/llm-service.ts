import { generateText, LanguageModel } from 'ai';
import {
  LlmModelFactoryI, LlmServiceI, ToolServiceI, UnifiedResponse,
} from './types';
import RateLimiter from './utils/rate-limiter';
import { PROVIDER_LIMITS } from './utils/provider-limits';
import { parseLlmResponse } from './utils/json-utils';

export default class LlmService implements LlmServiceI {
  private readonly model: LanguageModel;

  private readonly rateLimiter: RateLimiter;

  private readonly provider: string;

  private readonly toolService?: ToolServiceI;

  private readonly isFallbackMode;

  private readonly timeoutMs: number;

  private readonly openrouterEnableToolCalling: boolean;

  constructor(
    llmModelFactory: LlmModelFactoryI,
    rateLimiter: RateLimiter,
    isRateLimitDisabled: boolean,
    toolService?: ToolServiceI,
    options?: {
      timeoutMs?: number;
      openrouterEnableToolCalling?: boolean;
      requestsPerMinuteOverride?: number | null;
      tokensPerMinuteOverride?: number | null;
    },
  ) {
    const factory = llmModelFactory;
    this.model = factory.create();
    this.isFallbackMode = factory.isFallbackMode();
    this.provider = factory.getProvider();
    this.rateLimiter = rateLimiter;
    this.toolService = toolService;
    this.timeoutMs = options?.timeoutMs ?? 120_000;
    this.openrouterEnableToolCalling = options?.openrouterEnableToolCalling ?? false;

    // Resolve effective rate limits per axis with trichotomy:
    //   override === null      → fall back to provider default
    //   override === 0         → axis explicitly disabled
    //   override > 0           → custom limit
    const providerDefault = PROVIDER_LIMITS[this.provider];
    const requestsLimit = options?.requestsPerMinuteOverride
      ?? providerDefault?.requestsPerMinute;
    const tokensLimit = options?.tokensPerMinuteOverride
      ?? providerDefault?.tokensPerMinute;

    if (isRateLimitDisabled) {
      console.warn(`Rate limiter is disabled for provider: ${this.provider}`);
      return;
    }

    if (requestsLimit === undefined && tokensLimit === undefined) {
      console.warn(`No rate limits configured for provider: ${this.provider}`);
      return;
    }

    if (requestsLimit !== undefined) {
      this.rateLimiter.setProviderLimit(this.provider, requestsLimit);
    }
    const fmt = (n: number | undefined): string => {
      if (n === undefined) return 'unset';
      if (n === 0) return 'disabled';
      return `${n}/minute`;
    };
    console.log(
      `Rate limits for ${this.provider}: requests=${fmt(requestsLimit)}, tokens=${fmt(tokensLimit)}`,
    );
  }

  public async searchWeb(query: string): Promise<string> {
    if (!this.toolService) {
      return 'Search functionality is not available.';
    }

    try {
      console.log(`Performing web search for: "${query}"`);
      // Keep method bound to the instance; some implementations read instance state.
      const searchResult = await this.toolService.search?.(query);
      if (searchResult !== undefined) {
        return searchResult;
      }
      return 'Search tool is not available.';
    } catch (error) {
      console.error('Error during web search:', error);
      return `Error performing search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public async ask(prompt: string): Promise<UnifiedResponse[]> {
    try {
      console.log(`Making LLM request to ${this.provider}${this.isFallbackMode ? ' (fallback mode)' : ''}`);

      if (this.isFallbackMode) {
        const response = await this.askUsingFallbackModel(prompt);
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        if (!uuidRegex.test(response)) {
          console.warn('If you are using ollama and you see it all the time, check the ollama api logs.'
              + 'Maybe you need to use bigger context window');
          throw new Error(`Could not foud category in LLM response: ${response}`);
        }
        return [{
          transactionId: 'fallback',
          type: 'existing',
          categoryId: response,
        }];
      }

      return this.rateLimiter.executeWithRateLimiting(this.provider, async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        // Some OpenAI-compatible gateways/models (notably via OpenRouter) don't reliably support
        // tool/function-calling. We still keep ToolService around for manual/pre-prompt searches,
        // but disable model tool-calling to avoid malformed outputs.
        const disableOpenRouterTools = this.provider === 'openrouter' && !this.openrouterEnableToolCalling;
        const tools = disableOpenRouterTools ? undefined : this.toolService?.getTools();
        try {
          const { text } = await generateText({
            model: this.model,
            prompt,
            temperature: 0.2,
            tools,
            maxSteps: tools ? 3 : 1,
            maxRetries: 0,
            abortSignal: controller.signal,
          });

          // Only wrap parsing/validation errors; transport/provider errors must bubble up so the
          // RateLimiter can apply provider-specific backoff/retry behavior.
          try {
            return parseLlmResponse(text);
          } catch (error) {
            console.error('LLM response validation failed:', error);
            throw new Error('Invalid response format from LLM');
          }
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error during LLM request to ${this.provider}: ${errorMsg}`);
      throw error;
    }
  }

  public async askUsingFallbackModel(prompt: string): Promise<string> {
    return this.rateLimiter.executeWithRateLimiting(
      this.provider,
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        console.log(`Sending text generation request to ${this.provider}`);
        try {
          const { text } = await generateText({
            model: this.model,
            prompt,
            temperature: 0.1,
            abortSignal: controller.signal,
          });

          return text.replace(/(\r\n|\n|\r|"|')/gm, '');
        } finally {
          clearTimeout(timer);
        }
      },
    );
  }
}
