/**
 * Parses a rate-limit env var with trichotomy semantics:
 *
 *   - `null`        → env not set → caller should fall back to provider defaults
 *   - `0`           → env set to "0" → rate limiting explicitly disabled
 *   - positive      → env set to a positive number → custom limit
 *
 * Anything that doesn't parse to a finite, non-negative number (e.g. "abc",
 * "-5", " ") logs a warning and is treated as unset (`null`).
 */
export function parseRateLimitEnv(raw: string | undefined, varName?: string): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    console.warn(
      `Invalid value for ${varName ?? 'rate-limit env var'}: "${raw}" — falling back to provider default`,
    );
    return null;
  }

  return n;
}

export default parseRateLimitEnv;
