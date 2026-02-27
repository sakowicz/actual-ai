import ToolService from '../src/utils/tool-service';

describe('ToolService.formatSearchResults', () => {
  test('does not throw when ValueSerp results omit snippet/title/link', () => {
    const svc = new ToolService('dummy');
    // Accessing this method for unit testing internal formatting behavior.
    const serviceWithFormatter = Object(svc) as {
      formatSearchResults: (
        this: ToolService,
        results: {
          organic_results: {
            title?: string;
            snippet?: string;
            link?: string;
          }[];
        },
      ) => string;
    };
    const formatter = serviceWithFormatter.formatSearchResults;
    expect(typeof formatter).toBe('function');

    const result = formatter.call(svc, {
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
