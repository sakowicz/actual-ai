/* eslint-disable no-new */
import { LanguageModel } from 'ai';
import LlmService from '../src/llm-service';
import { LlmModelFactoryI } from '../src/types';
import RateLimiter from '../src/utils/rate-limiter';
import { PROVIDER_LIMITS } from '../src/utils/provider-limits';

const buildFactory = (provider: string): LlmModelFactoryI => ({
  create: () => ({}) as LanguageModel,
  getProvider: () => provider,
  getModelProvider: () => provider,
  isFallbackMode: () => false,
});

describe('LlmService rate-limit configuration', () => {
  let setProviderLimit: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    setProviderLimit = jest.spyOn(rateLimiter, 'setProviderLimit');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setProviderLimit.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('falls back to provider defaults when no override is provided', () => {
    new LlmService(buildFactory('openai'), rateLimiter, false, undefined);

    expect(setProviderLimit).toHaveBeenCalledWith(
      'openai',
      PROVIDER_LIMITS.openai.requestsPerMinute,
    );
  });

  it('uses custom override when requestsPerMinuteOverride > 0', () => {
    new LlmService(buildFactory('openai'), rateLimiter, false, undefined, {
      requestsPerMinuteOverride: 25,
    });

    expect(setProviderLimit).toHaveBeenCalledWith('openai', 25);
  });

  it('disables request rate limiting when requestsPerMinuteOverride === 0', () => {
    new LlmService(buildFactory('openai'), rateLimiter, false, undefined, {
      requestsPerMinuteOverride: 0,
    });

    expect(setProviderLimit).toHaveBeenCalledWith('openai', 0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requests=disabled'));
  });

  it('treats requestsPerMinuteOverride === null as "not set" and uses provider default', () => {
    new LlmService(buildFactory('openai'), rateLimiter, false, undefined, {
      requestsPerMinuteOverride: null,
    });

    expect(setProviderLimit).toHaveBeenCalledWith(
      'openai',
      PROVIDER_LIMITS.openai.requestsPerMinute,
    );
  });

  it('logs tokens=disabled when tokensPerMinuteOverride === 0', () => {
    new LlmService(buildFactory('openai'), rateLimiter, false, undefined, {
      tokensPerMinuteOverride: 0,
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('tokens=disabled'));
  });

  it('does not call setProviderLimit when isRateLimitDisabled feature flag is on', () => {
    new LlmService(buildFactory('openai'), rateLimiter, true, undefined, {
      requestsPerMinuteOverride: 25,
    });

    expect(setProviderLimit).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  it('warns when provider has no defaults and no overrides are given', () => {
    new LlmService(buildFactory('unknown-provider'), rateLimiter, false, undefined);

    expect(setProviderLimit).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No rate limits configured'),
    );
  });

  it('uses overrides for a provider that has no defaults', () => {
    new LlmService(buildFactory('unknown-provider'), rateLimiter, false, undefined, {
      requestsPerMinuteOverride: 42,
    });

    expect(setProviderLimit).toHaveBeenCalledWith('unknown-provider', 42);
  });
});
