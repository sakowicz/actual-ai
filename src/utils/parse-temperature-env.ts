/**
 * Parses LLM_TEMPERATURE:
 *
 *   - `undefined` → not set → the caller keeps its built-in default
 *   - `null`      → "none" → leave temperature out of the request so the provider's default
 *                   applies (some models, e.g. Claude Opus 5.5, reject any explicit value)
 *   - number      → that temperature
 *
 * Anything else (e.g. "abc") logs a warning and is treated as not set.
 */
export function parseTemperatureEnv(raw: string | undefined): number | null | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  if (trimmed.toLowerCase() === 'none') return null;

  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n)) {
    console.warn(`Invalid value for LLM_TEMPERATURE: "${raw}" — using the built-in default`);
    return undefined;
  }

  return n;
}

export default parseTemperatureEnv;
