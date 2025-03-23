interface RateLimitError extends Error {
  statusCode?: number;
  responseHeaders?: {
    'retry-after'?: string;
    'Retry-After'?: string;
  };
  responseBody?: string;
}

/**
 * Checks if an error is a rate limit error
 * @param error Any error object or value
 * @returns boolean indicating if this is a rate limit error
 */
export const isRateLimitError = (error: unknown): boolean => {
  if (!error) return false;
  const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
  return errorStr.toLowerCase().includes('rate limit')
    || errorStr.toLowerCase().includes('rate_limit')
    || errorStr.toLowerCase().includes('too many requests')
    || (error instanceof Error
      && 'statusCode' in error
      && (error as RateLimitError).statusCode === 429);
};

/**
 * Attempts to extract retry-after information from a rate limit error
 * @param error Rate limit error
 * @returns Time to wait in milliseconds or undefined if not found
 */
export const extractRetryAfterMs = (error: unknown): number | undefined => {
  if (!isRateLimitError(error)) return undefined;

  if (error instanceof Error) {
    try {
      const match = /try again in (\d+(\.\d+)?)s/i.exec(error.message);
      if (match?.[1]) {
        return Math.ceil(parseFloat(match[1]) * 1000);
      }
      if ('responseHeaders' in error && (error as RateLimitError).responseHeaders) {
        const headers = (error as RateLimitError).responseHeaders;
        if (headers?.['retry-after'] || headers?.['Retry-After']) {
          const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
          if (retryAfter && !Number.isNaN(Number(retryAfter))) {
            return Number(retryAfter) * 1000;
          }
        }
      }

      if ('responseBody' in error) {
        const { responseBody } = (error as RateLimitError);
        if (typeof responseBody === 'string') {
          try {
            const body = JSON.parse(responseBody) as { error?: { reset_time?: number } };
            if (body.error?.reset_time) {
              return body.error.reset_time * 1000;
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
    } catch (e) {
      console.warn('Error extracting retry-after information:', e);
    }
  }

  return undefined;
};

/**
 * Formats an error into a string
 * @param error Any error object or value
 * @returns string representation of the error
 */
export const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return '[object Object]';
    }
  }
  return String(error);
};

export default {
  isRateLimitError,
  extractRetryAfterMs,
  formatError,
};
