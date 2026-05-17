import { parseLlmResponse } from '../src/utils/json-utils';

describe('parseLlmResponse', () => {
  it('parses an existing-category response', () => {
    const result = parseLlmResponse('{"type": "existing", "categoryId": "abc"}');
    expect(result).toEqual([{ transactionId: 'test-transaction-id', type: 'existing', categoryId: 'abc' }]);
  });

  it('parses a rule match with a categoryId', () => {
    const result = parseLlmResponse(
      '{"type": "rule", "categoryId": "def", "ruleName": "Coffee Shop"}',
    );
    expect(result).toEqual([{ transactionId: 'test-transaction-id', type: 'rule', categoryId: 'def', ruleName: 'Coffee Shop' }]);
  });

  it('parses a "leave uncategorized" rule match — ruleName without categoryId', () => {
    const result = parseLlmResponse(
      '{"type": "rule", "ruleName": "Amazon leave uncategorized"}',
    );
    expect(result).toEqual([{ transactionId: 'test-transaction-id', type: 'rule', ruleName: 'Amazon leave uncategorized' }]);
    expect(result[0]?.categoryId).toBeUndefined();
  });

  it('treats rule match with explicit null categoryId as leave-uncategorized', () => {
    const result = parseLlmResponse(
      '{"type": "rule", "categoryId": null, "ruleName": "Skip Me"}',
    );
    expect(result[0]?.type).toBe('rule');
    expect(result[0]?.ruleName).toBe('Skip Me');
    expect(result[0]?.categoryId).toBeUndefined();
  });

  it('parses a new-category response', () => {
    const result = parseLlmResponse(
      '{"type": "new", "newCategory": {"name": "Pets", "groupName": "Home", "groupIsNew": true}}',
    );
    expect(result[0]?.type).toBe('new');
    expect(result[0]?.newCategory).toEqual({ name: 'Pets', groupName: 'Home', groupIsNew: true });
  });
});
