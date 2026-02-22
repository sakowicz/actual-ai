describe('ToolService freeWebSearch disable-on-403', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, FEATURES: '["freeWebSearch"]' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  test('disables repeated free web calls after HTTP 403 error', async () => {
    const FreeWebSearchService = (await import('../src/utils/free-web-search-service')).default;
    const searchSpy = jest.spyOn(FreeWebSearchService.prototype, 'search')
      .mockRejectedValue(new Error('Request failed with status code 403'));

    const ToolService = (await import('../src/utils/tool-service')).default;
    const toolService = new ToolService('');
    const tools = toolService.getTools();

    const first = await (tools.freeWebSearch as any).execute({ query: 'Example' });
    const second = await (tools.freeWebSearch as any).execute({ query: 'Another Query' });

    expect(first).toBe('Free web search is temporarily unavailable (HTTP 403).');
    expect(second).toBe('Free web search is temporarily unavailable (HTTP 403).');
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });
});

