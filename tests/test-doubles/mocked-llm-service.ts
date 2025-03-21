import { LlmServiceI } from '../../src/types';

export default class MockedLlmService implements LlmServiceI {
  private guess = 'uncategorized';

  async ask(): Promise<string> {
    return Promise.resolve(this.guess);
  }

  setGuess(guess: string): void {
    this.guess = guess;
  }
}
