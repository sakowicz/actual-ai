import { z } from 'zod';
import { generateObject, generateText, LanguageModel } from 'ai';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import {
  CategorySuggestion, LlmModelFactoryI, LlmServiceI, ToolServiceI,
} from './types';
import { RateLimiter } from './utils/rate-limiter';
import { PROVIDER_LIMITS } from './utils/provider-limits';

export default class LlmService implements LlmServiceI {
  private readonly llmModelFactory: LlmModelFactoryI;

  private readonly model: LanguageModel;

  private readonly rateLimiter: RateLimiter;

  private readonly provider: string;

  private readonly toolService?: ToolServiceI;

  private isFallbackMode;

  constructor(
    llmModelFactory: LlmModelFactoryI,
    toolService?: ToolServiceI,
  ) {
    this.llmModelFactory = llmModelFactory;
    this.model = llmModelFactory.create();
    this.isFallbackMode = llmModelFactory.isFallbackMode();
    this.provider = llmModelFactory.getProvider();
    this.rateLimiter = new RateLimiter(true);
    this.toolService = toolService;

    // Set rate limits for the provider
    const limits = PROVIDER_LIMITS[this.provider];
    if (limits) {
      this.rateLimiter.setProviderLimit(this.provider, limits.requestsPerMinute);
      console.log(`Set ${this.provider} rate limits: ${limits.requestsPerMinute} requests/minute, ${limits.tokensPerMinute} tokens/minute`);
    } else {
      console.warn(`No rate limits configured for provider: ${this.provider}`);
    }
  }

  public async searchWeb(query: string): Promise<string> {
    if (!this.toolService) {
      return 'Search functionality is not available.';
    }

    try {
      console.log(`Performing web search for: "${query}"`);
      if ('search' in this.toolService) {
        type SearchFunction = (q: string) => Promise<string>;
        const searchFn = this.toolService.search as SearchFunction;
        return await searchFn(query);
      }
      return 'Search tool is not available.';
    } catch (error) {
      console.error('Error during web search:', error);
      return `Error performing search: ${error instanceof Error ? error.message : String(error)}`;
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
  ): Promise<CategorySuggestion | null> {
    try {
      console.log(
        `Making LLM request for category suggestion to ${this.provider}${this.isFallbackMode ? ' (fallback mode)' : ''}`,
      );

      const categorySchema = z.object({
        name: z.string(),
        groupName: z.string(),
        groupIsNew: z.boolean(),
      });

      const response = await this.rateLimiter.executeWithRateLimiting<CategorySuggestion | null>(
        this.provider,
        async () => {
          const { text, steps } = await generateText({
            model: this.model,
            prompt,
            temperature: 0.2,
            tools: this.toolService?.getTools(),
            maxSteps: 3,
            system: 'You must use webSearch for unfamiliar payees before suggesting categories',
          });

          console.log('Generation steps:', steps.map((step) => ({
            text: step.text,
            toolCalls: step.toolCalls,
            toolResults: step.toolResults,
          })));

          // Parse the JSON response from the text
          try {
            const parsedResponse = JSON.parse(text) as unknown;
            // Validate against schema
            const result = categorySchema.safeParse(parsedResponse);
            return result.success ? result.data : null;
          } catch (e) {
            console.error('Failed to parse JSON response:', e);
            return null;
          }
        },
      );

      if (response) {
        return {
          name: response.name,
          groupName: response.groupName,
          groupIsNew: response.groupIsNew,
        };
      }

      console.warn('LLM response did not contain valid category suggestion format');
      return null;
    } catch (error) {
      console.error('Error while getting category suggestion:', error);
      return null;
    }
  }

  /**
   * Analyze if a transaction is similar to any existing rule and suggest a category
   * @param transaction The transaction to analyze
   * @param rules List of existing rules in the system
   * @param categories List of categories for reference
   * @param prompt The prompt to use for finding similar rules
   * @returns A suggested category ID if similar rules exist, null otherwise
   */
  public async findSimilarRules(
    transaction: TransactionEntity,
    prompt: string,
  ): Promise<{ categoryId: string; ruleName: string } | null> {
    try {
      console.log(
        `Checking if transaction "${transaction.imported_payee}" matches any existing rules`,
      );

      // console.log('Prompt:', prompt.slice(0, 300));

      return this.rateLimiter.executeWithRateLimiting<
      { categoryId: string; ruleName: string } | null>(
        this.provider,
        async () => {
          const { text, steps } = await generateText({
            model: this.model,
            prompt,
            temperature: 0.1,
            tools: this.toolService?.getTools(),
            maxSteps: 3,
            system: 'You must respond with pong if you receive don\'t have an answer',
          });

          console.log('Generation steps:', steps.map((step) => ({
            text: step.text,
            toolCalls: step.toolCalls,
            toolResults: step.toolResults,
          })));

          try {
            // Parse the JSON response
            const response = JSON.parse(text) as { categoryId?: string; ruleName?: string } | null;

            if (response?.categoryId && response.ruleName) {
              console.log(`Found similar rule "${response.ruleName}" suggesting category ${response.categoryId}`);
              return {
                categoryId: response.categoryId,
                ruleName: response.ruleName,
              };
            }

            return null;
          } catch {
            console.log('No similar rules found or invalid response');
            return null;
          }
        },
      );
    } catch (error) {
      console.error('Error while finding similar rules:', error);
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
