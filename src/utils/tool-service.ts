import * as https from 'https';
import { z } from 'zod';
import { tool, Tool } from 'ai';
import { ToolServiceI } from '../types';
import { getEnabledTools } from '../config';
import FreeWebSearchService from './free-web-search-service';

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

interface OrganicResults {
  organic_results?: SearchResult[];
}

export default class ToolService implements ToolServiceI {
  private readonly valueSerpApiKey: string;

  private readonly freeWebSearchService: FreeWebSearchService;

  constructor(valueSerpApiKey: string) {
    this.valueSerpApiKey = valueSerpApiKey;
    this.freeWebSearchService = new FreeWebSearchService();
  }

  public getTools() {
    const tools: Record<string, Tool> = {};

    if (getEnabledTools().includes('webSearch')) {
      tools.webSearch = tool({
        description: 'Essential for researching business types and industry categorizations when existing categories are insufficient. Use when payee is unfamiliar or category context is unclear',
        parameters: z.object({
          query: z.string().describe(
            'Combination of payee name and business type with search operators. '
            + 'Example: "StudntLN" (merchant|business|company|payee)',
          ),
        }),
        execute: async ({ query }: { query: string }): Promise<string> => {
          if (!this.valueSerpApiKey) return 'Search unavailable';
          console.log(`Performing web search for ${query}`);
          const results = await this.performSearch(query);
          return this.formatSearchResults(results);
        },
      });
    }

    if (getEnabledTools().includes('freeWebSearch')) {
      tools.freeWebSearch = tool({
        description: 'Search the web for business information when existing categories are insufficient. Uses free public search APIs. Use when payee is unfamiliar or category context is unclear',
        parameters: z.object({
          query: z.string().describe(
            'Combination of payee name and business type. '
            + 'Example: "StudntLN" or "Student Loan"',
          ),
        }),
        execute: async ({ query }: { query: string }): Promise<string> => {
          console.log(`Performing free web search for ${query}`);
          try {
            const results = await this.freeWebSearchService.search(query);
            return this.freeWebSearchService.formatSearchResults(results);
          } catch (error) {
            console.error('Error during free web search:', error);
            return 'Web search failed. Please try again later.';
          }
        },
      });
    }

    return tools;
  }

  private async performSearch(query: string): Promise<OrganicResults> {
    const params = new URLSearchParams({
      api_key: this.valueSerpApiKey,
      q: query,
      gl: 'us',
      hl: 'en',
      num: '5',
      output: 'json',
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.valueserp.com',
        path: `/search?${params.toString()}`,
        method: 'GET',
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData = JSON.parse(data) as OrganicResults;
              resolve(jsonData);
            } catch {
              reject(new Error('Failed to parse search results'));
            }
          } else {
            reject(new Error(`Search request failed with status code: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.end();
    });
  }

  private formatSearchResults(results: OrganicResults): string {
    if (!Array.isArray(results?.organic_results)) {
      return 'No relevant business information found.';
    }

    if (results.organic_results.length === 0) {
      return 'No clear business information found in search results.';
    }

    const processedResults: SearchResult[] = [];

    // Deduplication logic with first occurrence preference
    results.organic_results.forEach((result) => {
      const isDuplicate = processedResults.some(
        (pr) => this.getSimilarity(pr.title, result.title) > 0.8,
      );
      if (!isDuplicate) {
        processedResults.push(result);
      }
    });

    // Format first 3 unique results
    const formattedResults = processedResults.slice(0, 3)
      .map((result, index) => `[Source ${index + 1}] ${result.title}\n`
        + `${result.snippet.replace(/(\r\n|\n|\r)/gm, ' ').substring(0, 150)}...\n`
        + `URL: ${result.link}`).join('\n\n');

    return `SEARCH RESULTS:\n${formattedResults}`;
  }

  private getSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const words2 = str2.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

    if (!words1.length || !words2.length) return 0;

    const uniqueWords = Array.from(new Set(words1));
    const matches = uniqueWords.filter((word) => words2.includes(word));

    return matches.length / Math.max(uniqueWords.length, words2.length);
  }
}
