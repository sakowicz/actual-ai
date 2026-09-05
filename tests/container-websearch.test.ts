describe('container tool service wiring', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('creates ToolService when webSearch is enabled', async () => {
    process.env.FEATURES = '["webSearch"]';
    process.env.VALUESERP_API_KEY = 'value-serp-key';

    const mod = await import('../src/container');
    const toolService = mod.createToolService();

    expect(toolService).toBeDefined();
    expect(toolService!.getTools()).toHaveProperty('webSearch');
  });

  test('creates no ToolService when no tool is enabled', async () => {
    process.env.FEATURES = '["classifyOnStartup"]';

    const mod = await import('../src/container');

    expect(mod.createToolService()).toBeUndefined();
  });
});
