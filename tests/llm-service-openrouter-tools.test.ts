import { LanguageModel } from 'ai';
import { LlmModelFactoryI, ToolServiceI } from '../src/types';
import RateLimiter from '../src/utils/rate-limiter';

describe('LlmService OpenRouter tool-calling toggle', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('disables tools for openrouter by default', async () => {
    const generateTextMock = jest.fn().mockResolvedValue({
      text: '{"type":"existing","categoryId":"abc"}',
    });
    jest.doMock('ai', () => ({
      generateText: generateTextMock,
    }));

    const LlmService = (await import('../src/llm-service')).default;

    const llmModelFactory: LlmModelFactoryI = {
      create: () => ({}) as LanguageModel,
      getProvider: () => 'openrouter',
      getModelProvider: () => 'openrouter',
      isFallbackMode: () => false,
    };
    const rateLimiter = new RateLimiter();
    rateLimiter.executeWithRateLimiting = async <T>(
      _provider: string,
      op: () => Promise<T>,
    ): Promise<T> => op();
    const toolService: ToolServiceI = {
      getTools: () => ({ freeWebSearch: {} as never }),
      search: () => Promise.resolve('ok'),
    };

    const svc = new LlmService(llmModelFactory, rateLimiter, true, toolService);
    await svc.ask('prompt');

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const firstCall = generateTextMock.mock.calls[0] as [unknown] | undefined;
    if (!firstCall) {
      throw new Error('Expected generateText to be called');
    }
    const callOptions = firstCall[0] as { tools?: unknown };
    expect(callOptions.tools).toBeUndefined();
  });

  test('enables tools for openrouter when configured', async () => {
    const generateTextMock = jest.fn().mockResolvedValue({
      text: '{"type":"existing","categoryId":"abc"}',
    });
    jest.doMock('ai', () => ({
      generateText: generateTextMock,
    }));

    const LlmService = (await import('../src/llm-service')).default;

    const llmModelFactory: LlmModelFactoryI = {
      create: () => ({}) as LanguageModel,
      getProvider: () => 'openrouter',
      getModelProvider: () => 'openrouter',
      isFallbackMode: () => false,
    };
    const rateLimiter = new RateLimiter();
    rateLimiter.executeWithRateLimiting = async <T>(
      _provider: string,
      op: () => Promise<T>,
    ): Promise<T> => op();
    const toolService: ToolServiceI = {
      getTools: () => ({ freeWebSearch: {} as never }),
      search: () => Promise.resolve('ok'),
    };

    const svc = new LlmService(llmModelFactory, rateLimiter, true, toolService, {
      openrouterEnableToolCalling: true,
    });
    await svc.ask('prompt');

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const firstCall = generateTextMock.mock.calls[0] as [unknown] | undefined;
    if (!firstCall) {
      throw new Error('Expected generateText to be called');
    }
    const callOptions = firstCall[0] as { tools?: unknown };
    expect(callOptions.tools).toBeDefined();
  });
});
