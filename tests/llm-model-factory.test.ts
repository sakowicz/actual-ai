import LlmModelFactory from '../src/llm-model-factory';

describe('LlmModelFactory', () => {
  function createSut(provider: string): LlmModelFactory {
    return new LlmModelFactory(
      provider,
      'openai-api-key',
      'openai-model',
      'https://api.openai.com',
      'openrouter-api-key',
      'openrouter-model',
      'https://openrouter.ai/api/v1',
      'https://example.com',
      'actual-ai-tests',
      'https://api.anthropic.com',
      'anthropic-api-key',
      'anthropic-model',
      'google-model',
      'https://api.google.com',
      'google-api-key',
      'ollama-model',
      'https://api.ollama.com',
      'groq-api-key',
      'groq-model',
      'https://api.groq.com',
    );
  }

  it('should create an OpenAI model', () => {
    const sut = createSut('openai');
    const model = sut.create();
    expect(model.provider).toEqual('openai.chat');
  });

  it('should create an Anthropic model', () => {
    const sut = createSut('anthropic');
    const model = sut.create();
    expect(model.provider).toEqual('anthropic.messages');
  });

  it('should create an OpenRouter model (OpenAI-compatible)', () => {
    const sut = createSut('openrouter');
    const model = sut.create();
    expect(model).toBeDefined();
    expect(model.provider).toEqual('openrouter.chat');
  });

  it('should create a Google Generative AI model', () => {
    const sut = createSut('google-generative-ai');
    const model = sut.create();
    expect(model).toBeDefined();
    expect(model.provider).toEqual('google.generative-ai');
  });

  it('should create an Ollama model', () => {
    const sut = createSut('ollama');
    const model = sut.create();
    expect(model).toBeDefined();
    expect(model.provider).toEqual('ollama.chat');
  });

  it('should create a Groq model', () => {
    const sut = createSut('groq');
    const model = sut.create();
    expect(model).toBeDefined();
    expect(model.provider).toEqual('groq.chat');
  });

  it('should throw an error for an unknown provider', () => {
    const sut = createSut('123');
    expect(() => sut.create()).toThrow('Unknown provider: 123');
  });

  it('should return fallback provider for ollama', () => {
    const sut = createSut('ollama');

    expect(sut.isFallbackMode()).toEqual(true);
  });

  it('should return not fallback provider for openai', () => {
    const sut = createSut('openai');

    expect(sut.isFallbackMode()).toEqual(false);
  });

  it('should return not fallback provider for groq', () => {
    const sut = createSut('groq');

    expect(sut.isFallbackMode()).toEqual(false);
  });
});
