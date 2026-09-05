import { LanguageModel } from 'ai';
import { LlmModelFactoryI, UnifiedResponse } from '../src/types';
import RateLimiter from '../src/utils/rate-limiter';

async function askFallback(text: string): Promise<UnifiedResponse> {
  jest.doMock('ai', () => ({ generateText: jest.fn().mockResolvedValue({ text }) }));

  const LlmService = (await import('../src/llm-service')).default;
  const llmModelFactory: LlmModelFactoryI = {
    create: () => ({}) as LanguageModel,
    getProvider: () => 'ollama',
    getModelProvider: () => 'ollama',
  };
  const rateLimiter = new RateLimiter();
  rateLimiter.executeWithRateLimiting = async <T>(
    _provider: string,
    op: () => Promise<T>,
  ): Promise<T> => op();

  return new LlmService(llmModelFactory, rateLimiter, true).ask('prompt');
}

describe('LlmService fallback response parsing', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('accepts a bare category id', async () => {
    await expect(askFallback('11111111-1111-1111-1111-111111111111')).resolves.toEqual({
      type: 'existing',
      categoryId: '11111111-1111-1111-1111-111111111111',
    });
  });

  test('accepts a suggested new category', async () => {
    await expect(askFallback(
      '{"type": "new", "newCategory": {"name": "Bank Transaction", "groupName": "Bank", "groupIsNew": true}}',
    )).resolves.toEqual({
      type: 'new',
      newCategory: { name: 'Bank Transaction', groupName: 'Bank', groupIsNew: true },
    });
  });

  test('accepts JSON wrapped in a code fence', async () => {
    await expect(askFallback(
      '```json\n{"type": "existing", "categoryId": "22222222-2222-2222-2222-222222222222"}\n```',
    )).resolves.toEqual({
      type: 'existing',
      categoryId: '22222222-2222-2222-2222-222222222222',
    });
  });

  test('digs a category id out of surrounding prose', async () => {
    await expect(askFallback(
      'I think the best match is 33333333-3333-3333-3333-333333333333, because it is groceries.',
    )).resolves.toEqual({
      type: 'existing',
      categoryId: '33333333-3333-3333-3333-333333333333',
    });
  });

  test('reports an answer that carries no category at all', async () => {
    await expect(askFallback('I am not sure about this transaction.'))
      .rejects.toThrow(/Could not find category in LLM response/);
  });
});
