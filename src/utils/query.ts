/** First string value of a query param, or undefined. */
export const queryString = (value: unknown): string | undefined => {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};

export const queryInt = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number.parseInt(queryString(value) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};
