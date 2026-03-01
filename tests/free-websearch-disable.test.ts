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
    const freeWebSearchTool = tools.freeWebSearch;
    if (!freeWebSearchTool?.execute) {
      throw new Error('freeWebSearch tool is unavailable');
    }
    const execute = freeWebSearchTool.execute.bind(freeWebSearchTool);

    await expect(
      execute({ query: 'Example' }, { toolCallId: 't1', messages: [] } as never),
    ).resolves.toBe('Free web search is temporarily unavailable (HTTP 403).');
    await expect(
      execute({ query: 'Another Query' }, { toolCallId: 't2', messages: [] } as never),
    ).resolves.toBe('Free web search is temporarily unavailable (HTTP 403).');

    expect(searchSpy).toHaveBeenCalledTimes(1);
  });
});
