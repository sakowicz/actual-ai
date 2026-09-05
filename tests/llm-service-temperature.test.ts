import { LanguageModel } from 'ai';
import { LlmModelFactoryI } from '../src/types';
import RateLimiter from '../src/utils/rate-limiter';

async function callWith(temperature: number | undefined): Promise<{ temperature?: number }> {
  const generateTextMock = jest.fn().mockResolvedValue({
    text: '{"type":"existing","categoryId":"abc"}',
  });
  jest.doMock('ai', () => ({ generateText: generateTextMock }));

  const LlmService = (await import('../src/llm-service')).default;

  const llmModelFactory: LlmModelFactoryI = {
    create: () => ({}) as LanguageModel,
    getProvider: () => 'openai',
    getModelProvider: () => 'openai',
  };
  const rateLimiter = new RateLimiter();
  rateLimiter.executeWithRateLimiting = async <T>(
    _provider: string,
    op: () => Promise<T>,
  ): Promise<T> => op();

  const svc = new LlmService(llmModelFactory, rateLimiter, true, undefined, { temperature });
  await svc.ask('prompt');

  const firstCall = generateTextMock.mock.calls[0] as [{ temperature?: number }] | undefined;
  if (!firstCall) {
    throw new Error('Expected generateText to be called');
  }
  return firstCall[0];
}

describe('LlmService temperature', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps the built-in default when no temperature is configured', async () => {
    expect((await callWith(undefined)).temperature).toBe(0.2);
  });

  test('uses the configured temperature', async () => {
    expect((await callWith(1)).temperature).toBe(1);
  });

  test('allows zero as an explicit temperature', async () => {
    expect((await callWith(0)).temperature).toBe(0);
  });
});
