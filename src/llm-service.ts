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

  private readonly timeoutMs: number;

  private readonly openrouterEnableToolCalling: boolean;

  private readonly temperature: number | undefined;

  constructor(
    llmModelFactory: LlmModelFactoryI,
    rateLimiter: RateLimiter,
    isRateLimitDisabled: boolean,
    toolService?: ToolServiceI,
    options?: {
      timeoutMs?: number;
      openrouterEnableToolCalling?: boolean;
      temperature?: number;
      requestsPerMinuteOverride?: number | null;
      tokensPerMinuteOverride?: number | null;
    },
  ) {
    const factory = llmModelFactory;
    this.model = factory.create();
    this.provider = factory.getProvider();
    this.rateLimiter = rateLimiter;
    this.toolService = toolService;
    this.timeoutMs = options?.timeoutMs ?? 120_000;
    this.openrouterEnableToolCalling = options?.openrouterEnableToolCalling ?? false;
    this.temperature = options?.temperature;

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

  public async ask(prompt: string): Promise<UnifiedResponse> {
    try {
      console.log(`Making LLM request to ${this.provider}`);

      return await this.rateLimiter.executeWithRateLimiting(this.provider, async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const tools = this.supportsToolCalling() ? this.toolService?.getTools() : undefined;
        try {
          const { text } = await generateText({
            model: this.model,
            prompt,
            temperature: this.temperature ?? 0.2,
            tools,
            maxSteps: tools ? 3 : 1,
            abortSignal: controller.signal,
          });

          // Only wrap parsing/validation errors; transport/provider errors must bubble up so the
          // RateLimiter can apply provider-specific backoff/retry behavior.
          return this.parseResponse(text);
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

  /**
   * Ollama models cannot call tools at all, and OpenAI-compatible gateways (notably OpenRouter)
   * do it unreliably enough to produce malformed output. ToolService stays available either way
   * for searches run before the prompt is built.
   */
  private supportsToolCalling(): boolean {
    if (this.provider === 'ollama') {
      return false;
    }
    return this.provider !== 'openrouter' || this.openrouterEnableToolCalling;
  }

  /**
   * Models answer with whatever they feel like: the documented JSON object, that JSON wrapped in
   * prose or code fences, or a bare category id. Parse the structured answer first and only fall
   * back to fishing an id out of the text.
   */
  private parseResponse(text: string): UnifiedResponse {
    try {
      return parseLlmResponse(text);
    } catch {
      const categoryId = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(text);
      if (categoryId) {
        return { type: 'existing', categoryId: categoryId[0] };
      }

      if (this.provider === 'ollama') {
        console.warn('If you see this all the time, check the ollama api logs. '
          + 'Maybe you need to use a bigger context window.');
      }
      throw new Error(`Could not find category in LLM response: ${text}`);
    }
  }
}
