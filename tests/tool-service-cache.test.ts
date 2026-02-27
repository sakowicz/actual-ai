describe('ToolService caching', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  test('freeWebSearch results are cached per query', async () => {
    process.env.FEATURES = '["freeWebSearch"]';

    const FreeWebSearchService = (await import('../src/utils/free-web-search-service')).default;
    const searchSpy = jest.spyOn(FreeWebSearchService.prototype, 'search')
      .mockResolvedValue([{ title: 'T', snippet: 'S', link: 'L' }]);
    jest.spyOn(FreeWebSearchService.prototype, 'formatSearchResults')
      .mockReturnValue('SEARCH RESULTS:\n[Source 1] T');

    const ToolService = (await import('../src/utils/tool-service')).default;
    const toolService = new ToolService('');
    const tools = toolService.getTools();
    const freeWebSearchTool = tools.freeWebSearch;
    if (!freeWebSearchTool?.execute) {
      throw new Error('freeWebSearch tool is unavailable');
    }
    const execute = freeWebSearchTool.execute.bind(freeWebSearchTool);

    // Call tool twice with identical query; underlying search should execute once.
    await expect(
      execute({ query: 'Example' }, { toolCallId: 't1', messages: [] } as never),
    ).resolves.toBe('SEARCH RESULTS:\n[Source 1] T');
    await expect(
      execute({ query: 'Example' }, { toolCallId: 't2', messages: [] } as never),
    ).resolves.toBe('SEARCH RESULTS:\n[Source 1] T');
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  test('cache entry expires after TTL', async () => {
    process.env.FEATURES = '["freeWebSearch"]';

    const FreeWebSearchService = (await import('../src/utils/free-web-search-service')).default;
    const searchSpy = jest.spyOn(FreeWebSearchService.prototype, 'search')
      .mockResolvedValue([{ title: 'T', snippet: 'S', link: 'L' }]);
    jest.spyOn(FreeWebSearchService.prototype, 'formatSearchResults')
      .mockReturnValue('SEARCH RESULTS:\n[Source 1] T');

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);

    const ToolService = (await import('../src/utils/tool-service')).default;
    const toolService = new ToolService('');
    const freeWebSearchTool = toolService.getTools().freeWebSearch;
    if (!freeWebSearchTool?.execute) {
      throw new Error('freeWebSearch tool is unavailable');
    }
    const execute = freeWebSearchTool.execute.bind(freeWebSearchTool);

    await execute({ query: 'Example' }, { toolCallId: 't1', messages: [] } as never);
    nowSpy.mockReturnValue(1_000 + (30 * 60 * 1000) + 1);
    await execute({ query: 'Example' }, { toolCallId: 't2', messages: [] } as never);

    expect(searchSpy).toHaveBeenCalledTimes(2);
  });

  test('cache evicts oldest entries when size cap is reached', async () => {
    process.env.FEATURES = '["freeWebSearch"]';

    const FreeWebSearchService = (await import('../src/utils/free-web-search-service')).default;
    const searchSpy = jest.spyOn(FreeWebSearchService.prototype, 'search')
      .mockResolvedValue([{ title: 'T', snippet: 'S', link: 'L' }]);
    jest.spyOn(FreeWebSearchService.prototype, 'formatSearchResults')
      .mockReturnValue('SEARCH RESULTS:\n[Source 1] T');

    const ToolService = (await import('../src/utils/tool-service')).default;
    const toolService = new ToolService('');
    const freeWebSearchTool = toolService.getTools().freeWebSearch;
    if (!freeWebSearchTool?.execute) {
      throw new Error('freeWebSearch tool is unavailable');
    }
    const execute = freeWebSearchTool.execute.bind(freeWebSearchTool);

    // Fill up 201 unique entries (max is 200), forcing oldest eviction.
    await Array.from({ length: 201 }, (_, i) => i).reduce(async (prev, i) => {
      await prev;
      await execute({ query: `Example ${i}` }, { toolCallId: `t${i}`, messages: [] } as never);
    }, Promise.resolve());
    await execute({ query: 'Example 0' }, { toolCallId: 't-final', messages: [] } as never);

    expect(searchSpy).toHaveBeenCalledTimes(202);
  });
});
