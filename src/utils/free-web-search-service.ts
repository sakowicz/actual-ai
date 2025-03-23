import * as https from 'https';
import { SearchResult } from '../types';

/**
 * A free web search service that can be used as an alternative to ValueSerp.
 * This service uses the SerpApi.com free API to search the web.
 */
export default class FreeWebSearchService {
  /**
   * Search the web using a free API
   */
  public async search(query: string): Promise<SearchResult[]> {
    return this.searchUsingDDG(query);
  }

  /**
   * Search using DuckDuckGo API
   */
  private async searchUsingDDG(query: string): Promise<SearchResult[]> {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const html = await this.fetchUrl(url);

    // console.debug('[SearchService] DDG raw response:', html);
    const results: SearchResult[] = [];

    const rowRegex = /<tr>\s*<td[^>]*>(\d+)\.&nbsp;<\/td>\s*<td>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td>[^<]*<\/td>\s*<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
    let match;
    let count = 0;
    while (count < 5) {
      match = rowRegex.exec(html);
      if (match === null) break;

      const [, , link, title, snippet] = match;
      const cleanSnippet = snippet
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const result = {
        title: this.decodeHtmlEntities(title),
        snippet: cleanSnippet,
        link,
      };

      // console.debug('[SearchService] Parsed DDG result:', result);
      results.push(result);

      if (results.length >= 5) break;

      count += 1;
    }

    // console.debug('[SearchService] Final DDG results:', results);
    return results;
  }

  /**
   * Fetch a URL and return the response as text
   */
  private async fetchUrl(url: string, retries = 3): Promise<string> {
    // console.debug('[SearchService] Fetching URL:', url);
    return new Promise((resolve, reject) => {
      const attempt = () => {
        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }, (res) => {
          // console.debug(`[SearchService] HTTP ${res.statusCode} for ${url}`);
          if (res.statusCode === 202 && retries > 0) {
            setTimeout(attempt, 1000);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Request failed with status code ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }).on('error', (err) => {
          reject(err);
        });
      };
      attempt();
    });
  }

  /**
   * Format search results in a similar way to the ValueSerp service
   */
  public formatSearchResults(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return 'No relevant business information found.';
    }

    // Format results
    const formattedResults = results
      .map((result, index) => `[Source ${index + 1}] ${result.title}\n`
        + `${result.snippet.substring(0, 150)}...\n`
        + `URL: ${result.link}`)
      .join('\n\n');

    return `SEARCH RESULTS:\n${formattedResults}`;
  }

  /**
   * Decode HTML entities in a string
   */
  private decodeHtmlEntities(html: string): string {
    return html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
