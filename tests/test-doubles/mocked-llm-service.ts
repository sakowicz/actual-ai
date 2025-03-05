import { CategorySuggestion, LlmServiceI } from '../../src/types';

export default class MockedLlmService implements LlmServiceI {
  private guess = 'uncategorized';

  async ask(): Promise<string> {
    return Promise.resolve(this.guess);
  }

  async askForCategorySuggestion(): Promise<CategorySuggestion | null> {
    return Promise.resolve(null);
  }

  setGuess(guess: string): void {
    this.guess = guess;
  }

  async findSimilarRules(): Promise<{ categoryId: string; ruleName: string } | null> {
    return Promise.resolve(null);
  }
}
