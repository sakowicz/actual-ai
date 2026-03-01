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

interface CachedSearchResult {
  value: string;
  expiresAt: number;
}

export default class ToolService implements ToolServiceI {
  private static readonly CACHE_TTL_MS = 30 * 60 * 1000;

  private static readonly CACHE_MAX_ENTRIES = 200;

  private readonly valueSerpApiKey: string;

  private readonly freeWebSearchService: FreeWebSearchService;

  private readonly webSearchCache = new Map<string, CachedSearchResult>();

  private readonly freeWebSearchCache = new Map<string, CachedSearchResult>();

  private freeWebSearchDisabledMessage = '';

  constructor(valueSerpApiKey: string) {
    this.valueSerpApiKey = valueSerpApiKey;
    this.freeWebSearchService = new FreeWebSearchService();
  }

  /**
   * Run a single search outside of model tool-calling. This is useful for providers/models
   * that do not reliably support function/tool calling.
   */
  public async search(query: string): Promise<string> {
    const q = this.normalizeQuery(query);
    if (!q) return 'Search unavailable';

    if (getEnabledTools().includes('webSearch')) {
      return this.searchWithCache({
        query: q,
        cache: this.webSearchCache,
        unavailableMessage: 'Search unavailable',
        searchTypeLabel: 'web search',
        executor: async (normalizedQuery) => {
          if (!this.valueSerpApiKey) return 'Search unavailable';
          const results = await this.performSearch(normalizedQuery);
          return this.formatSearchResults(results);
        },
      });
    }

    if (getEnabledTools().includes('freeWebSearch')) {
      return this.searchWithCache({
        query: q,
        cache: this.freeWebSearchCache,
        unavailableMessage: this.freeWebSearchDisabledMessage || 'Search unavailable',
        searchTypeLabel: 'free web search',
        executor: async (normalizedQuery) => {
          if (this.freeWebSearchDisabledMessage) return this.freeWebSearchDisabledMessage;
          try {
            const results = await this.freeWebSearchService.search(normalizedQuery);
            return this.freeWebSearchService.formatSearchResults(results);
          } catch (error) {
            this.setFreeWebSearchBackoffOnHttpError(error);
            console.error('Error during free web search:', error);
            return this.freeWebSearchDisabledMessage || 'Web search failed. Please try again later.';
          }
        },
      });
    }

    return 'Search unavailable';
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
          return this.searchWithCache({
            query,
            cache: this.webSearchCache,
            unavailableMessage: 'Search unavailable',
            searchTypeLabel: 'web search',
            executor: async (normalizedQuery) => {
              if (!this.valueSerpApiKey) return 'Search unavailable';
              const results = await this.performSearch(normalizedQuery);
              return this.formatSearchResults(results);
            },
          });
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
          return this.searchWithCache({
            query,
            cache: this.freeWebSearchCache,
            unavailableMessage: this.freeWebSearchDisabledMessage || 'Search unavailable',
            searchTypeLabel: 'free web search',
            executor: async (normalizedQuery) => {
              if (this.freeWebSearchDisabledMessage) return this.freeWebSearchDisabledMessage;
              try {
                const results = await this.freeWebSearchService.search(normalizedQuery);
                return this.freeWebSearchService.formatSearchResults(results);
              } catch (error) {
                this.setFreeWebSearchBackoffOnHttpError(error);
                console.error('Error during free web search:', error);
                return this.freeWebSearchDisabledMessage || 'Web search failed. Please try again later.';
              }
            },
          });
        },
      });
    }

    return tools;
  }

  private normalizeQuery(query: string): string {
    return query.trim();
  }

  private getCachedResult(
    cache: Map<string, CachedSearchResult>,
    cacheKey: string,
  ): string | undefined {
    const cached = cache.get(cacheKey);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
      cache.delete(cacheKey);
      return undefined;
    }
    return cached.value;
  }

  private setCachedResult(
    cache: Map<string, CachedSearchResult>,
    cacheKey: string,
    value: string,
  ): void {
    this.pruneExpiredEntries(cache);
    if (cache.size >= ToolService.CACHE_MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ToolService.CACHE_TTL_MS,
    });
  }

  private pruneExpiredEntries(cache: Map<string, CachedSearchResult>): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
  }

  private async searchWithCache({
    query,
    cache,
    unavailableMessage,
    searchTypeLabel,
    executor,
  }: {
    query: string;
    cache: Map<string, CachedSearchResult>;
    unavailableMessage: string;
    searchTypeLabel: string;
    executor: (normalizedQuery: string) => Promise<string>;
  }): Promise<string> {
    const normalizedQuery = this.normalizeQuery(query);
    if (!normalizedQuery) return unavailableMessage;
    const cacheKey = normalizedQuery.toLowerCase();
    const cached = this.getCachedResult(cache, cacheKey);
    if (cached) return cached;
    console.log(`Performing ${searchTypeLabel} for ${normalizedQuery}`);
    const result = await executor(normalizedQuery);
    this.setCachedResult(cache, cacheKey, result);
    return result;
  }

  private setFreeWebSearchBackoffOnHttpError(error: unknown): void {
    if (this.freeWebSearchDisabledMessage) return;
    const message = error instanceof Error ? error.message : String(error ?? '');
    const statusMatch = /status code[: ]+(\d{3})/i.exec(message);
    const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : NaN;
    if (status === 403 || status === 429) {
      this.freeWebSearchDisabledMessage = `Free web search is temporarily unavailable (HTTP ${status}).`;
    }
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
    results.organic_results.forEach((result: any) => {
      // ValueSerp occasionally omits fields (e.g. snippet) depending on result type.
      // Normalize to strings so formatting never throws.
      const normalized: SearchResult = {
        title: typeof result?.title === 'string' ? result.title : '',
        snippet: typeof result?.snippet === 'string' ? result.snippet : '',
        link: typeof result?.link === 'string' ? result.link : '',
      };
      const isDuplicate = processedResults.some(
        (pr) => this.getSimilarity(pr.title, normalized.title) > 0.8,
      );
      if (!isDuplicate) {
        processedResults.push(normalized);
      }
    });

    // Format first 3 unique results
    const formattedResults = processedResults.slice(0, 3)
      .map((result, index) => `[Source ${index + 1}] ${result.title}\n`
        + `${(result.snippet || '').replace(/(\r\n|\n|\r)/gm, ' ').substring(0, 150)}...\n`
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
