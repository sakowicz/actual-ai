import { z } from 'zod';
import { generateObject, generateText, LanguageModel } from 'ai';
import { LlmModelFactoryI, LlmServiceI } from './types';
import { RateLimiter } from './utils/rate-limiter';
import { PROVIDER_LIMITS } from './utils/provider-limits';

export default class LlmService implements LlmServiceI {
  private readonly llmModelFactory: LlmModelFactoryI;

  private readonly model: LanguageModel;

  private readonly rateLimiter: RateLimiter;

  private readonly provider: string;

  private isFallbackMode;

  constructor(
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.llmModelFactory = llmModelFactory;
    this.model = llmModelFactory.create();
    this.isFallbackMode = llmModelFactory.isFallbackMode();
    this.provider = llmModelFactory.getProvider();
    this.rateLimiter = new RateLimiter(true);

    // Set rate limits for the provider
    const limits = PROVIDER_LIMITS[this.provider];
    if (limits) {
      this.rateLimiter.setProviderLimit(this.provider, limits.requestsPerMinute);
      console.log(`Set ${this.provider} rate limits: ${limits.requestsPerMinute} requests/minute, ${limits.tokensPerMinute} tokens/minute`);
    } else {
      console.warn(`No rate limits configured for provider: ${this.provider}`);
    }
  }

  public async ask(prompt: string, categoryIds: string[]): Promise<string> {
    try {
      console.log(`Making LLM request to ${this.provider}${this.isFallbackMode ? ' (fallback mode)' : ''}`);

      if (this.isFallbackMode) {
        return await this.askUsingFallbackModel(prompt);
      }

      return await this.askWithEnum(prompt, categoryIds);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error during LLM request to ${this.provider}: ${errorMsg}`);
      throw error;
    }
  }

  public async askForCategorySuggestion(
    prompt: string,
  ): Promise<{ name: string, groupId: string } | null> {
    try {
      console.log(
        `Making LLM request for category suggestion to ${this.provider}${this.isFallbackMode ? ' (fallback mode)' : ''}`,
      );

      const response = await this.rateLimiter.executeWithRateLimiting(
        this.provider,
        async () => {
          const result = await generateObject({
            model: this.model,
            prompt,
            temperature: 0.2,
            output: 'object',
            schema: z.object({
              name: z.string(),
              groupId: z.string(),
            }),
            mode: 'json',
          });
          return result.object;
        },
      );

      if (response && typeof response === 'object' && 'name' in response && 'groupId' in response) {
        return {
          name: String(response.name),
          groupId: String(response.groupId),
        };
      }

      console.warn('LLM response did not contain valid category suggestion format:', response);
      return null;
    } catch (error) {
      console.error('Error while getting category suggestion:', error);
      return null;
    }
  }

  public async askWithEnum(prompt: string, categoryIds: string[]): Promise<string> {
    return this.rateLimiter.executeWithRateLimiting(
      this.provider,
      async () => {
        console.log(`Sending enum request to ${this.provider} with ${categoryIds.length} options`);
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
        console.log(`Sending text generation request to ${this.provider}`);
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
