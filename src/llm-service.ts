import { generateObject, generateText, LanguageModel } from 'ai';
import { LlmModelFactoryI, LlmServiceI } from './types';
import { RateLimiter } from './utils/rate-limiter';
import { PROVIDER_LIMITS } from './utils/provider-limits';

export default class LlmService implements LlmServiceI {
  private readonly model: LanguageModel;

  private readonly rateLimiter: RateLimiter;

  private readonly provider: string;

  private isFallbackMode;

  constructor(
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.model = llmModelFactory.create();
    this.isFallbackMode = llmModelFactory.isFallbackMode();
    this.provider = llmModelFactory.getProvider();
    this.rateLimiter = new RateLimiter();

    // Set rate limits for the provider
    const limits = PROVIDER_LIMITS[this.provider];
    if (limits) {
      this.rateLimiter.setProviderLimit(this.provider, limits.requestsPerMinute);
    }
  }

  public async ask(prompt: string, categoryIds: string[]): Promise<string> {
    try {
      if (this.isFallbackMode) {
        return await this.askUsingFallbackModel(prompt);
      }

      return await this.askWithEnum(prompt, categoryIds);
    } catch (error) {
      console.error(`Error during LLM request: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public async askWithEnum(prompt: string, categoryIds: string[]): Promise<string> {
    return this.rateLimiter.executeWithRateLimiting(
      this.provider,
      async () => {
        const { object } = await generateObject({
          model: this.model,
          output: 'enum',
          enum: categoryIds,
          prompt,
          temperature: 0.1,
        });

        return object.replace(/(\r\n|\n|\r|"|')/gm, '');
      },
    );
  }

  public async askUsingFallbackModel(prompt: string): Promise<string> {
    return this.rateLimiter.executeWithRateLimiting(
      this.provider,
      async () => {
        const { text } = await generateText({
          model: this.model,
          prompt,
          temperature: 0.1,
        });

        return text.replace(/(\r\n|\n|\r|"|')/gm, '');
      },
    );
  }
}
