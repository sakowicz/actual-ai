import ToolService from '../src/utils/tool-service';

describe('ToolService.formatSearchResults', () => {
  test('does not throw when ValueSerp results omit snippet/title/link', () => {
    const svc = new ToolService('dummy');

    const result = (svc as any).formatSearchResults({
      organic_results: [
        { title: 'Example', link: 'https://example.com' }, // missing snippet
        { snippet: 'Hello world' }, // missing title/link
        {}, // missing everything
      ],
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('SEARCH RESULTS');
  });
});

