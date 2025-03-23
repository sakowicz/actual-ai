import FreeWebSearchService from '../../src/utils/free-web-search-service';

describe('FreeWebSearchService', () => {
  let freeWebSearchService: FreeWebSearchService;

  beforeEach(() => {
    freeWebSearchService = new FreeWebSearchService();
    // Mock the fetchUrl method to avoid making actual HTTP requests
    jest.spyOn(freeWebSearchService as unknown as { fetchUrl: (url: string) => Promise<string> }, 'fetchUrl')
      .mockImplementation(() => Promise.resolve(`
        <tr>
          <td>1.&nbsp;</td>
          <td><a href="https://example.com/1">Example Result 1</a></td>
        </tr>
        <tr>
          <td></td>
          <td class="result-snippet">Sample snippet 1</td>
        </tr>
        <tr>
          <td>2.&nbsp;</td>
          <td><a href="https://example.com/2">Example Result 2</a></td>
        </tr>
        <tr>
          <td></td>
          <td class="result-snippet">Sample snippet 2</td>
        </tr>
      `));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('search', () => {
    it('should return DDG results with correct structure', async () => {
      const results = await freeWebSearchService.search('test query');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        title: 'Example Result 1',
        snippet: 'Sample snippet 1',
        link: 'https://example.com/1',
      });
      expect(results[1]).toEqual({
        title: 'Example Result 2',
        snippet: 'Sample snippet 2',
        link: 'https://example.com/2',
      });
    });
  });

  describe('formatSearchResults', () => {
    it('should format search results correctly', () => {
      const results = [
        {
          title: 'Example Result 1',
          snippet: 'This is a sample snippet for result 1',
          link: 'https://example.com/1',
        },
        {
          title: 'Example Result 2',
          snippet: 'This is a sample snippet for result 2',
          link: 'https://example.com/2',
        },
      ];

      const formatted = freeWebSearchService.formatSearchResults(results);

      expect(formatted).toContain('SEARCH RESULTS:');
      expect(formatted).toContain('[Source 1] Example Result 1');
      expect(formatted).toContain('[Source 2] Example Result 2');
      expect(formatted).toContain('URL: https://example.com/1');
      expect(formatted).toContain('URL: https://example.com/2');
    });

    it('should handle empty results', () => {
      const formatted = freeWebSearchService.formatSearchResults([]);

      expect(formatted).toBe('No relevant business information found.');
    });
  });
});
