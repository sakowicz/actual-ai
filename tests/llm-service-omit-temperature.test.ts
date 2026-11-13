import { LanguageModel } from 'ai';
import LlmService from '../src/llm-service';
import { LlmModelFactoryI } from '../src/types';
import RateLimiter from '../src/utils/rate-limiter';

type CallOptions = Parameters<LanguageModel['doGenerate']>[0];

// Runs the real AI SDK against a fake model, so these tests see the options the provider would
// turn into the HTTP request, after the SDK has applied its own defaults.
async function requestSentWith(temperature: number | null | undefined): Promise<CallOptions> {
  const doGenerate = jest.fn((_options: CallOptions) => Promise.resolve({
    text: '{"type":"existing","categoryId":"abc"}',
    finishReason: 'stop' as const,
    usage: { promptTokens: 1, completionTokens: 1 },
    rawCall: { rawPrompt: null, rawSettings: {} },
  }));
  const model: LanguageModel = {
    specificationVersion: 'v1',
    provider: 'test',
    modelId: 'test-model',
    defaultObjectGenerationMode: undefined,
    doGenerate,
    doStream: () => Promise.reject(new Error('not used')),
  };
  const llmModelFactory: LlmModelFactoryI = {
    create: () => model,
    getProvider: () => 'anthropic',
    getModelProvider: () => 'anthropic',
  };
  const rateLimiter = new RateLimiter();
  rateLimiter.executeWithRateLimiting = <T>(
    _provider: string,
    op: () => Promise<T>,
  ): Promise<T> => op();

  const svc = new LlmService(llmModelFactory, rateLimiter, true, undefined, { temperature });
  await svc.ask('prompt');

  const firstCall = doGenerate.mock.calls[0];
  if (!firstCall) {
    throw new Error('Expected the model to be called');
  }
  return firstCall[0];
}

describe('LlmService temperature in the request', () => {
  test('leaves temperature out with LLM_TEMPERATURE=none', async () => {
    const options = await requestSentWith(null);
    expect(options.temperature).toBeUndefined();
  });

  test('sends the built-in default when no temperature is configured', async () => {
    expect((await requestSentWith(undefined)).temperature).toBe(0.2);
  });

  test('sends a configured temperature', async () => {
    expect((await requestSentWith(1)).temperature).toBe(1);
  });
});
