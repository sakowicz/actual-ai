import {
  generateObject, generateText, LanguageModel, TypeValidationError,
} from 'ai';
import { LlmModelFactoryI, LlmServiceI } from './types';

export default class LlmService implements LlmServiceI {
  private readonly model: LanguageModel;

  private isFallbackMode = false;

  constructor(
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.model = llmModelFactory.create();
  }

  public async ask(prompt: string, categoryIds: string[]): Promise<string> {
    if (this.isFallbackMode) {
      return this.askUsingFallbackModel(prompt);
    }

    try {
      return this.askWithEnum(prompt, categoryIds);
    } catch (error) {
      if (!(error instanceof TypeValidationError)) {
        throw error;
      }

      console.warn('Looks like the model does not support enum generation. Falling back to text generation.');

      this.isFallbackMode = true;
      return this.askUsingFallbackModel(prompt);
    }
  }

  public async askWithEnum(prompt: string, categoryIds: string[]): Promise<string> {
    const { object } = await generateObject({
      model: this.model,
      output: 'enum',
      enum: categoryIds,
      prompt,
      temperature: 0.1,
    });

    return object.replace(/(\r\n|\n|\r|"|')/gm, '');
  }

  public async askUsingFallbackModel(prompt: string): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      prompt,
      temperature: 0.1,
    });

    return text.replace(/(\r\n|\n|\r|"|')/gm, '');
  }
}
