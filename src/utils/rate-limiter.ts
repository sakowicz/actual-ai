// Define a custom error type for API rate limiting errors
interface RateLimitError extends Error {
  statusCode?: number;
  responseHeaders?: Record<string, string>;
}

interface RetryParams {
  retryAfterMs?: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

interface TokenBucket {
  limit: number;
  remaining: number;
  resetTimestamp: number;
}

export class RateLimiter {
  private requestCounts = new Map<string, number>();

  private lastRequestTime = new Map<string, number>();

  private maxRequestsPerMinute = new Map<string, number>();

  private tokenBuckets = new Map<string, TokenBucket>();

  private debugMode = false;

  constructor(debug = false) {
    this.debugMode = debug;
  }

  public setProviderLimit(provider: string, limit: number): void {
    this.maxRequestsPerMinute.set(provider, limit);
  }

  public enableDebug(): void {
    this.debugMode = true;
  }

  public async executeWithRateLimiting<T>(
    provider: string,
    operation: () => Promise<T>,
    retryParams: RetryParams = {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitter: true,
    },
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retryParams.maxRetries) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${retryParams.maxRetries} for ${provider}...`);
        }

        // Wait before proceeding if we need to
        await this.waitIfNeeded(provider);

        // Track this request
        this.trackRequest(provider);

        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (this.isRateLimitError(error)) {
          // Update token bucket information if available
          this.updateTokenBucketFromError(provider, error);

          // Get retry delay from error or calculate backoff
          const retryAfterMs = this.extractRetryAfterMs(error) ?? this.calculateBackoff(
            attempt,
            retryParams.baseDelayMs,
            retryParams.maxDelayMs,
            retryParams.jitter,
          );

          // Add additional details in debug mode
          if (this.debugMode) {
            console.log(`Rate limit details for ${provider}:`, this.getRateLimitDebugInfo(provider, error));
          }

          console.log(`Rate limit hit for ${provider}. Waiting ${retryAfterMs}ms before retry.`);
          await this.sleep(retryAfterMs);
          attempt += 1;
        } else {
          // Not a rate limit error, rethrow
          throw error;
        }
      }
    }

    // If we've exhausted all retries
    throw new Error(`Rate limit retries exceeded (${retryParams.maxRetries}). Last error: ${lastError?.message}`);
  }

  private getRateLimitDebugInfo(provider: string, error: unknown): object {
    const bucket = this.tokenBuckets.get(provider);
    const errorInfo: { message: string; statusCode?: number; headers?: Record<string, string> } = {
      message: '',
    };

    if (error instanceof Error) {
      errorInfo.message = error.message;
      // Type guard for rate limit errors
      const rateLimitError = error as Partial<RateLimitError>;
      if ('statusCode' in error) errorInfo.statusCode = rateLimitError.statusCode;
      if ('responseHeaders' in error) errorInfo.headers = rateLimitError.responseHeaders;
    }

    return {
      provider,
      errorInfo,
      tokenBucket: bucket ?? 'No token data available',
      requestsInLastMinute: this.requestCounts.get(provider) ?? 0,
      maxRequestsPerMinute: this.maxRequestsPerMinute.get(provider) ?? 'No limit set',
    };
  }

  private updateTokenBucketFromError(provider: string, error: unknown): void {
    if (!(error instanceof Error)) return;

    try {
      const errorMsg = error.message;

      // Extract Groq token information
      // Example: "Limit 100000, Used 99336, Requested 821"
      const limitMatch = /Limit (\d+), Used (\d+), Requested (\d+)/.exec(errorMsg);
      if (limitMatch) {
        const [, limitStr, usedStr] = limitMatch;
        const limit = parseInt(limitStr, 10);
        const used = parseInt(usedStr, 10);

        // Extract wait time: "Please try again in 2m14.975999999s"
        const waitTimeMatch = /try again in ((\d+)m)?(\d+(\.\d+)?)s/i.exec(errorMsg);
        let waitTimeMs = 0;

        if (waitTimeMatch) {
          const minutes = waitTimeMatch[2] ? parseInt(waitTimeMatch[2], 10) : 0;
          const seconds = parseFloat(waitTimeMatch[3]);
          waitTimeMs = (minutes * 60 + seconds) * 1000;
        }

        const now = Date.now();
        this.tokenBuckets.set(provider, {
          limit,
          remaining: Math.max(0, limit - used),
          resetTimestamp: now + waitTimeMs,
        });

        if (this.debugMode) {
          console.log(`Updated token bucket for ${provider}:`, this.tokenBuckets.get(provider));
        }
      }
    } catch (e) {
      console.warn('Error updating token bucket from error:', e);
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for common rate limit status codes and messages
      const rateLimitError = error as Partial<RateLimitError>;
      if ('statusCode' in error && rateLimitError.statusCode === 429) {
        return true;
      }

      // Check for rate limit messages
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes('rate limit')
        || errorMessage.includes('too many requests');
    }
    return false;
  }

  private extractRetryAfterMs(error: unknown): number | undefined {
    if (error instanceof Error) {
      try {
        // Try to extract from Groq error message
        const match = /try again in ((\d+)m)?(\d+(\.\d+)?)s/i.exec(error.message);
        if (match) {
          const minutes = match[2] ? parseInt(match[2], 10) : 0;
          const seconds = parseFloat(match[3]);
          return Math.ceil((minutes * 60 + seconds) * 1000);
        }

        // Try to get from headers if available
        const rateLimitError = error as Partial<RateLimitError>;
        if ('responseHeaders' in error && rateLimitError.responseHeaders) {
          const headers = rateLimitError.responseHeaders;
          if (headers && 'retry-after' in headers) {
            const retryAfter = headers['retry-after'];
            if (retryAfter && Number.isNaN(Number(retryAfter)) === false) {
              return Number(retryAfter) * 1000;
            }
          }
        }
      } catch (e) {
        console.warn('Error extracting retry-after information:', e);
      }
    }
    return undefined;
  }

  private calculateBackoff(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    jitter: boolean,
  ): number {
    // Exponential backoff: baseDelay * 2^attempt
    let delay = Math.min(baseDelay * 2 ** attempt, maxDelay);

    // Add jitter to avoid thundering herd problem
    if (jitter) {
      delay *= (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private trackRequest(provider: string): void {
    const now = Date.now();
    const count = this.requestCounts.get(provider) ?? 0;
    const lastTime = this.lastRequestTime.get(provider) ?? 0;

    // Reset counter if more than a minute has passed
    if (now - lastTime > 60000) {
      this.requestCounts.set(provider, 1);
    } else {
      this.requestCounts.set(provider, count + 1);
    }

    this.lastRequestTime.set(provider, now);
  }

  private async waitIfNeeded(provider: string): Promise<void> {
    const limit = this.maxRequestsPerMinute.get(provider) ?? 0;
    const count = this.requestCounts.get(provider) ?? 0;
    const lastTime = this.lastRequestTime.get(provider) ?? 0;
    const now = Date.now();
    let waitTime = 0;

    // Check token bucket first - this has priority
    const bucket = this.tokenBuckets.get(provider);
    if (bucket && bucket.resetTimestamp > now) {
      // If we're close to the limit and reset time is in the future
      if (bucket.remaining < bucket.limit * 0.10) {
        waitTime = bucket.resetTimestamp - now + 1000; // add 1 second buffer
        console.log(`Waiting ${waitTime}ms for token bucket to reset for ${provider}`);
        await this.sleep(waitTime);
        return;
      }
    }

    // If we have a request limit set and we're approaching it
    if (limit && count >= limit * 0.8) {
      // If less than a minute has passed since the first request in this window
      if (now - lastTime < 60000) {
        // Calculate time remaining until the minute is up
        waitTime = 60000 - (now - lastTime) + 100; // add 100ms buffer
        console.log(`Preemptively waiting ${waitTime}ms to avoid rate limit for ${provider}`);
        await this.sleep(waitTime);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export default RateLimiter;
