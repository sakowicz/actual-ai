describe('container tool service wiring', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('creates ToolService when freeWebSearch is enabled even without ValueSerp key', async () => {
    process.env.FEATURES = '["freeWebSearch"]';
    process.env.VALUESERP_API_KEY = '';

    const mod = await import('../src/container');
    const toolService = mod.createToolService();

    expect(toolService).toBeDefined();
    expect(toolService!.getTools()).toHaveProperty('freeWebSearch');
  });
});

