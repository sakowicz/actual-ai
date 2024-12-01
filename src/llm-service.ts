import { generateText, LanguageModel } from 'ai';
import { LlmModelFactoryI, LlmServiceI } from './types';

export default class LlmService implements LlmServiceI {
  private readonly model: LanguageModel;

  constructor(
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.model = llmModelFactory.create();
  }

  public async ask(prompt: string): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      prompt,
      temperature: 0.1,
      maxTokens: 35,
    });

    return text.replace(/(\r\n|\n|\r|"|')/gm, '');
  }
}
