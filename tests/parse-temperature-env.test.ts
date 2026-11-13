import { parseTemperatureEnv } from '../src/utils/parse-temperature-env';

describe('parseTemperatureEnv', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns undefined when the env var is not set', () => {
    expect(parseTemperatureEnv(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty or whitespace-only value', () => {
    expect(parseTemperatureEnv('')).toBeUndefined();
    expect(parseTemperatureEnv('   ')).toBeUndefined();
  });

  it('returns null for "none", in any case', () => {
    expect(parseTemperatureEnv('none')).toBeNull();
    expect(parseTemperatureEnv(' NONE ')).toBeNull();
  });

  it('returns the parsed number', () => {
    expect(parseTemperatureEnv('1')).toBe(1);
    expect(parseTemperatureEnv('0.7')).toBe(0.7);
  });

  it('keeps zero as an explicit temperature', () => {
    expect(parseTemperatureEnv('0')).toBe(0);
  });

  it('returns undefined and warns for anything else', () => {
    expect(parseTemperatureEnv('omit')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"omit"'));
  });
});
