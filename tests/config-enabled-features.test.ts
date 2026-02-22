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
      ENABLED_FEATURES: 'freeWebSearch,prePromptWebSearch',
    };

    const config = await import('../src/config');
    expect(config.getEnabledTools()).toContain('freeWebSearch');
    expect(config.isFeatureEnabled('prePromptWebSearch')).toBe(true);
  });

  test('supports ENABLED_FEATURES JSON array', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      FEATURES: '',
      ENABLED_FEATURES: '["skipTransferLike"]',
    };

    const config = await import('../src/config');
    expect(config.isFeatureEnabled('skipTransferLike')).toBe(true);
  });
});
