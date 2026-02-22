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

    const llmModelFactory = {
      create: () => ({}),
      getProvider: () => 'groq',
      isFallbackMode: () => false,
    } as any;

    const rateLimiter = {
      executeWithRateLimiting: async (_provider: string, op: () => Promise<any>) => op(),
    } as any;

    const svc = new LlmService(llmModelFactory, rateLimiter, true, undefined);

    await expect(svc.ask('prompt')).rejects.toThrow('Rate limit reached');
    await expect(svc.ask('prompt')).rejects.not.toThrow('Invalid response format from LLM');
  });

  test('wraps invalid JSON responses as invalid response format', async () => {
    jest.doMock('ai', () => ({
      generateText: jest.fn().mockResolvedValue({ text: 'not json' }),
    }));

    const LlmService = (await import('../src/llm-service')).default;

    const llmModelFactory = {
      create: () => ({}),
      getProvider: () => 'groq',
      isFallbackMode: () => false,
    } as any;

    const rateLimiter = {
      executeWithRateLimiting: async (_provider: string, op: () => Promise<any>) => op(),
    } as any;

    const svc = new LlmService(llmModelFactory, rateLimiter, true, undefined);

    await expect(svc.ask('prompt')).rejects.toThrow('Invalid response format from LLM');
  });
});

