import RateLimiter from '../../src/utils/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    jest.useFakeTimers();
    // Mock the sleep function to resolve immediately
    jest.spyOn(rateLimiter as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockImplementation(() => Promise.resolve());
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    consoleSpy.mockRestore();
  });

  describe('setProviderLimit', () => {
    it('should set the provider limit', async () => {
      rateLimiter.setProviderLimit('test-provider', 10);

      // Create a test function that will be rate limited
      const operation = jest.fn().mockResolvedValue('success');

      // Execute the operation multiple times
      for (let i = 0; i < 9; i++) {
        await rateLimiter.executeWithRateLimiting('test-provider', operation);
      }

      // Verify the operation was called the expected number of times
      expect(operation).toHaveBeenCalledTimes(9);
    });

    it('should enforce rate limits when approaching the limit', async () => {
      // Set a low provider limit
      rateLimiter.setProviderLimit('test-provider', 5);

      const operation = jest.fn().mockResolvedValue('success');

      // Execute operations up to 80% of the limit
      for (let i = 0; i < 4; i++) {
        await rateLimiter.executeWithRateLimiting('test-provider', operation);
      }

      expect(operation).toHaveBeenCalledTimes(4);

      // Next operation should trigger preemptive waiting
      await rateLimiter.executeWithRateLimiting('test-provider', operation);

      // Verify the sleep was called with correct delay
      // This implicitly tests waitIfNeeded when count >= limit * 0.8
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Preemptively waiting'));
    });
  });

  describe('executeWithRateLimiting', () => {
    it('should execute the operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await rateLimiter.executeWithRateLimiting('test-provider', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit errors with status code 429', async () => {
      const rateLimitError = new Error('rate limit exceeded');
      Object.assign(rateLimitError, { statusCode: 429 });

      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const result = await rateLimiter.executeWithRateLimiting('test-provider', operation, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitter: false,
      });

      jest.advanceTimersByTime(100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit hit for test-provider'));
    });

    it('should retry on rate limit errors with rate limit message', async () => {
      const rateLimitError = new Error('too many requests, please try again later');

      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const result = await rateLimiter.executeWithRateLimiting('test-provider', operation, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitter: false,
      });

      jest.advanceTimersByTime(100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const rateLimitError = new Error('rate limit exceeded');
      Object.assign(rateLimitError, { statusCode: 429 });

      const operation = jest.fn().mockRejectedValue(rateLimitError);

      await expect(rateLimiter.executeWithRateLimiting('test-provider', operation, {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitter: false,
      })).rejects.toThrow('Rate limit retries exceeded');

      jest.advanceTimersByTime(100); // First retry
      jest.advanceTimersByTime(200); // Second retry (exponential backoff)

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should extract retry time from error message', async () => {
      const rateLimitError = new Error('Rate limit exceeded. Please try again in 2m14s');
      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const result = await rateLimiter.executeWithRateLimiting('test-provider', operation);
      expect(result).toBe('success');

      // Should mention waiting with a time close to the parsed value (2m14s = 134000ms)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit hit for test-provider. Waiting 134000ms'));
    });

    it('should extract retry time from headers', async () => {
      const rateLimitError = new Error('rate limit exceeded');
      Object.assign(rateLimitError, {
        statusCode: 429,
        responseHeaders: {
          'retry-after': '10',
        },
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const result = await rateLimiter.executeWithRateLimiting('test-provider', operation);
      expect(result).toBe('success');

      // Should mention waiting 10 seconds (10000ms)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit hit for test-provider. Waiting 10000ms'));
    });

    it('should handle non-rate limit errors', async () => {
      const regularError = new Error('regular error');
      const operation = jest.fn().mockRejectedValue(regularError);

      await expect(rateLimiter.executeWithRateLimiting('test-provider', operation))
        .rejects.toThrow('regular error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff with jitter', async () => {
      // Mock Math.random to return a consistent value for testability
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const rateLimitError = new Error('rate limit exceeded');
      Object.assign(rateLimitError, { statusCode: 429 });

      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      await rateLimiter.executeWithRateLimiting('test-provider', operation, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitter: true,
      });

      // First retry should have baseDelay with jitter: 1000ms * 0.75 = 750ms
      // Second retry should have exponential backoff: 2000ms * 0.75 = 1500ms
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Waiting 750ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Waiting 1500ms'));

      randomSpy.mockRestore();
    });
  });

  describe('token bucket handling', () => {
    it('should update token bucket from Groq error message', async () => {
      const groqError = new Error('Limit 100000, Used 99336, Requested 821. Please try again in 30s');
      Object.assign(groqError, { statusCode: 429 });

      const operation = jest.fn()
        .mockRejectedValueOnce(groqError)
        .mockResolvedValueOnce('success');

      rateLimiter.enableDebug();

      const result = await rateLimiter.executeWithRateLimiting('groq', operation);
      expect(result).toBe('success');

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit details for groq:'),
        expect.objectContaining({
          tokenBucket: expect.objectContaining({
            limit: 100000,
            remaining: 664,
          }) as unknown as {
            limit: number;
            remaining: number;
            resetTimestamp?: number;
          },
        }),
      );
    });

    it('should wait for token bucket reset when close to limit', async () => {
      const groqError = new Error('Limit 100, Used 95, Requested 5. Please try again in 30s');
      Object.assign(groqError, { statusCode: 429 });

      const operation1 = jest.fn()
        .mockRejectedValueOnce(groqError)
        .mockResolvedValueOnce('success');

      await rateLimiter.executeWithRateLimiting('groq', operation1);

      // Now try a second operation that should trigger waiting due to low token bucket
      const operation2 = jest.fn().mockResolvedValue('second-success');
      await rateLimiter.executeWithRateLimiting('groq', operation2);

      // Should have logged waiting for token bucket
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Waiting') && expect.stringContaining('for token bucket to reset for groq'));
    });
  });

  describe('debug mode', () => {
    it('should enable debug mode through constructor', () => {
      const debugRateLimiter = new RateLimiter(true);
      expect(debugRateLimiter).toBeDefined();
    });

    it('should enable debug mode through method call', () => {
      rateLimiter.enableDebug();

      // Create a rate limit error to trigger debug logging
      const rateLimitError = new Error('rate limit exceeded');
      Object.assign(rateLimitError, { statusCode: 429 });

      const operation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      return rateLimiter.executeWithRateLimiting('test-provider', operation)
        .then(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Rate limit details for test-provider:'),
            expect.any(Object),
          );
        });
    });
  });
});
