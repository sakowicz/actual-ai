import { parseLlmResponse } from '../src/utils/json-utils';

describe('parseLlmResponse', () => {
  it('parses an existing-category response', () => {
    const result = parseLlmResponse('{"type": "existing", "categoryId": "abc"}');
    expect(result).toEqual({ type: 'existing', categoryId: 'abc' });
  });

  it('parses a rule match with a categoryId', () => {
    const result = parseLlmResponse(
      '{"type": "rule", "categoryId": "def", "ruleName": "Coffee Shop"}',
    );
    expect(result).toEqual({ type: 'rule', categoryId: 'def', ruleName: 'Coffee Shop' });
  });

  it('parses a "leave uncategorized" rule match — ruleName without categoryId', () => {
    const result = parseLlmResponse(
      '{"type": "rule", "ruleName": "Amazon leave uncategorized"}',
    );
    expect(result).toEqual({ type: 'rule', ruleName: 'Amazon leave uncategorized' });
    expect(result.categoryId).toBeUndefined();
  });

  it('treats rule match with explicit null categoryId as leave-uncategorized', () => {
    const result = parseLlmResponse(
      '{"type": "rule", "categoryId": null, "ruleName": "Skip Me"}',
    );
    expect(result.type).toBe('rule');
    expect(result.ruleName).toBe('Skip Me');
    expect(result.categoryId).toBeUndefined();
  });

  it('parses a new-category response', () => {
    const result = parseLlmResponse(
      '{"type": "new", "newCategory": {"name": "Pets", "groupName": "Home", "groupIsNew": true}}',
    );
    expect(result.type).toBe('new');
    expect(result.newCategory).toEqual({ name: 'Pets', groupName: 'Home', groupIsNew: true });
  });

  it('parses a fenced JSON response', () => {
    expect(parseLlmResponse('```json\n{"type": "existing", "categoryId": "abc"}\n```'))
      .toEqual({ type: 'existing', categoryId: 'abc' });
  });

  it('parses a bare category id', () => {
    expect(parseLlmResponse('3de93c74-04be-4a32-8131-226f1d0efd69'))
      .toEqual({ type: 'existing', categoryId: '3de93c74-04be-4a32-8131-226f1d0efd69' });
  });

  // Regression: prose reasoning that echoes bracketed note tags ("[enricher]…")
  // made the first-structure-character cut land in the prose, discarding the
  // valid JSON object at the end of the response.
  it('recovers the trailing JSON object from a prose response', () => {
    const prose = 'The `[enricher]` note from the email receipt identifies the item as: '
      + '**"WUBEN G5 LED Taschenlampe"** — a tech gadget purchased on Amazon.\n'
      + '- The amount matches (23.98 EUR)\n\n'
      + '{"type": "existing", "categoryId": "3de93c74-04be-4a32-8131-226f1d0efd69"}';
    expect(parseLlmResponse(prose))
      .toEqual({ type: 'existing', categoryId: '3de93c74-04be-4a32-8131-226f1d0efd69' });
  });

  it('still rejects a response with no JSON object at all', () => {
    expect(() => parseLlmResponse('I cannot categorize this [enricher] transaction.'))
      .toThrow('Invalid response format from LLM');
  });
});
