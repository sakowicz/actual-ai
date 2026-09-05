import { LanguageModel } from 'ai';
import { LlmModelFactoryI } from '../src/types';
import RateLimiter from '../src/utils/rate-limiter';

describe('LlmService error handling', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('propagates provider/rate-limit errors (does not wrap as invalid response)', async () => {
    const rateLimitErr = Object.assign(new Error('Rate limit reached'), { statusCode: 429 });

    jest.doMock('ai', () => ({
      generateText: jest.fn().mockRejectedValue(rateLimitErr),
    }));

    const LlmService = (await import('../src/llm-service')).default;

    const llmModelFactory: LlmModelFactoryI = {
      create: () => ({}) as LanguageModel,
      getProvider: () => 'groq',
      getModelProvider: () => 'groq',
    };

    const rateLimiter = new RateLimiter();
    rateLimiter.executeWithRateLimiting = async <T>(
      _provider: string,
      op: () => Promise<T>,
    ): Promise<T> => op();

    const svc = new LlmService(llmModelFactory, rateLimiter, true, undefined);

    await expect(svc.ask('prompt')).rejects.toThrow('Rate limit reached');
    await expect(svc.ask('prompt')).rejects.not.toThrow('Could not find category in LLM response');
  });

  test('reports a response that carries no category, quoting what came back', async () => {
    jest.doMock('ai', () => ({
      generateText: jest.fn().mockResolvedValue({ text: 'not json' }),
    }));

    const LlmService = (await import('../src/llm-service')).default;

    const llmModelFactory: LlmModelFactoryI = {
      create: () => ({}) as LanguageModel,
      getProvider: () => 'groq',
      getModelProvider: () => 'groq',
    };

    const rateLimiter = new RateLimiter();
    rateLimiter.executeWithRateLimiting = async <T>(
      _provider: string,
      op: () => Promise<T>,
    ): Promise<T> => op();

    const svc = new LlmService(llmModelFactory, rateLimiter, true, undefined);

    await expect(svc.ask('prompt')).rejects.toThrow('Could not find category in LLM response: not json');
  });
});
