describe('ToolService caching', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
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

    // Call tool twice with identical query; underlying search should execute once.
    const first = await (tools.freeWebSearch as any).execute({ query: 'Example' });
    const second = await (tools.freeWebSearch as any).execute({ query: 'Example' });

    expect(first).toBe('SEARCH RESULTS:\n[Source 1] T');
    expect(second).toBe('SEARCH RESULTS:\n[Source 1] T');
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });
});

