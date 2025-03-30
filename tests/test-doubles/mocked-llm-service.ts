import { LlmServiceI, UnifiedResponse } from '../../src/types';

export default class MockedLlmService implements LlmServiceI {
  private guess = ''; // Type inferred

  private unifiedResponse: UnifiedResponse | null = null;

  async ask(_prompt: string, _categoryIds?: string[]): Promise<UnifiedResponse> {
    if (this.unifiedResponse) {
      return Promise.resolve(this.unifiedResponse);
    }

    // Fallback to old guess behavior if unifiedResponse is not set
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    // Check if guess is a UUID
    if (uuidRegex.test(this.guess)) {
      return Promise.resolve({ type: 'existing', categoryId: this.guess });
    }
    if (this.guess === 'Groceries') { // Simulate finding by name for old test
      return Promise.resolve({ type: 'existing', categoryId: 'ff7be77b-40f4-4e9d-aea4-be6b8c431281' });
    }

    // Simulate rule match if guess contains 'rule:'
    if (this.guess.includes('rule:')) {
      const ruleName = this.guess.split('rule:')[1]?.trim();
      // Provide a dummy category ID for rule match for now
      return Promise.resolve({ type: 'rule', ruleName, categoryId: 'rule-cat-id' });
    }

    // Default: Simulate a 'miss' (no category found)
    return Promise.resolve({ type: 'existing' }); // No categoryId means it will be marked as miss
  }

  setGuess(guess: string): void {
    this.guess = guess;
    this.unifiedResponse = null; // Clear unified response when setting old guess
  }

  setUnifiedResponse(response: UnifiedResponse): void {
    this.unifiedResponse = response;
    this.guess = ''; // Clear old guess when setting unified response
  }
}
