import { generateObject, LanguageModel } from 'ai';
import { LlmModelFactoryI, LlmServiceI } from './types';

export default class LlmService implements LlmServiceI {
  private readonly model: LanguageModel;

  constructor(
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.model = llmModelFactory.create();
  }

  public async ask(prompt: string, categoryIds: string[]): Promise<string> {
    const { object } = await generateObject({
      model: this.model,
      output: 'enum',
      enum: categoryIds,
      prompt,
      temperature: 0.1,
    });

    return object.replace(/(\r\n|\n|\r|"|')/gm, '');
  }
}
