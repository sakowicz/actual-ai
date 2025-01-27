import { generateObject, generateText, LanguageModel } from 'ai';
import { LlmModelFactoryI, LlmServiceI } from './types';

export default class LlmService implements LlmServiceI {
  private readonly model: LanguageModel;

  private isFallbackMode;

  constructor(
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.model = llmModelFactory.create();
    this.isFallbackMode = llmModelFactory.isFallbackMode();
  }

  public async ask(prompt: string, categoryIds: string[]): Promise<string> {
    if (this.isFallbackMode) {
      return this.askUsingFallbackModel(prompt);
    }

    return this.askWithEnum(prompt, categoryIds);
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
