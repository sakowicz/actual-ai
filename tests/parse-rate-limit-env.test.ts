import { parseRateLimitEnv } from '../src/utils/parse-rate-limit-env';

describe('parseRateLimitEnv', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns null when env var is undefined', () => {
    expect(parseRateLimitEnv(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseRateLimitEnv('')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(parseRateLimitEnv('   ')).toBeNull();
  });

  it('returns 0 when explicitly set to "0" — caller treats this as disabled', () => {
    expect(parseRateLimitEnv('0')).toBe(0);
  });

  it('returns the parsed number for a positive integer', () => {
    expect(parseRateLimitEnv('150')).toBe(150);
  });

  it('returns the parsed number for a positive float', () => {
    expect(parseRateLimitEnv('60.5')).toBe(60.5);
  });

  it('returns null and warns for a non-numeric value', () => {
    expect(parseRateLimitEnv('abc', 'TOKENS_PER_MINUTE')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TOKENS_PER_MINUTE'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"abc"'));
  });

  it('returns null and warns for a negative number', () => {
    expect(parseRateLimitEnv('-1', 'REQUESTS_PER_MINUTE')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns null and warns for Infinity', () => {
    expect(parseRateLimitEnv('Infinity')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
