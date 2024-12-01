import { LanguageModel } from 'ai';
import { GenerateTextFunction, LlmModelFactoryI, LlmServiceI } from './types';

export default class LlmService implements LlmServiceI {
  private generateText: GenerateTextFunction;

  private model: LanguageModel;

  constructor(
    generateText: GenerateTextFunction,
    llmModelFactory: LlmModelFactoryI,
  ) {
    this.generateText = generateText;
    this.model = llmModelFactory.create();
  }

  public async ask(prompt: string): Promise<string> {
    const { text } = await this.generateText({
      model: this.model,
      prompt,
      temperature: 0.1,
      max_tokens: 50,
    });

    return text.replace(/(\r\n|\n|\r|"|')/gm, '');
  }
}
