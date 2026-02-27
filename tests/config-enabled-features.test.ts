describe('config feature env parsing', () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  test('supports ENABLED_FEATURES comma-separated list', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      FEATURES: '',
      ENABLED_FEATURES: 'freeWebSearch,suggestNewCategories',
    };

    const config = await import('../src/config');
    expect(config.getEnabledTools()).toContain('freeWebSearch');
    expect(config.isFeatureEnabled('suggestNewCategories')).toBe(true);
  });

  test('supports ENABLED_FEATURES JSON array', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      FEATURES: '',
      ENABLED_FEATURES: '["disableRateLimiter"]',
    };

    const config = await import('../src/config');
    expect(config.isFeatureEnabled('disableRateLimiter')).toBe(true);
  });

  test('parses LLM timeout and OpenRouter tool-calling env values', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      LLM_TIMEOUT_MS: '45000',
      OPENROUTER_ENABLE_TOOL_CALLING: 'true',
    };

    const config = await import('../src/config');
    expect(config.llmTimeoutMs).toBe(45000);
    expect(config.openrouterEnableToolCalling).toBe(true);
  });
});
