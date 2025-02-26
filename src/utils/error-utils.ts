/**
 * Checks if an error is a rate limit error
 * @param error Any error object or value
 * @returns boolean indicating if this is a rate limit error
 */
export const isRateLimitError = (error: unknown): boolean => {
  if (!error) return false;

  // Convert to string to handle various error types
  const errorStr = String(error);

  // Check for common rate limit indicators
  return errorStr.toLowerCase().includes('rate limit')
    || errorStr.toLowerCase().includes('rate_limit')
    || errorStr.toLowerCase().includes('too many requests')
    || (error instanceof Error
      && 'statusCode' in error
      && (error as any).statusCode === 429);
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
      // Check for retry information in error message (common in provider responses)
      const match = /try again in (\d+(\.\d+)?)s/i.exec(error.message);
      if (match?.[1]) {
        return Math.ceil(parseFloat(match[1]) * 1000);
      }

      // Try to get from headers if available
      if ('responseHeaders' in error && (error as any).responseHeaders) {
        const headers = (error as any).responseHeaders;
        if (headers['retry-after'] || headers['Retry-After']) {
          const retryAfter = headers['retry-after'] || headers['Retry-After'];
          if (!isNaN(Number(retryAfter))) {
            return Number(retryAfter) * 1000;
          }
        }
      }

      // Check for reset time in responseBody if it exists
      if ('responseBody' in error && typeof (error as any).responseBody === 'string') {
        try {
          const body = JSON.parse((error as any).responseBody);
          if (body.error?.reset_time) {
            return body.error.reset_time * 1000;
          }
        } catch (e) {
          // Ignore JSON parse errors
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
