// Same output as the frontend's src/utils/format.ts, fixed to UTC so the server's zone does not matter.
export const formatDate = (value: string): string =>
  new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const formatTime = (hhmm: string): string => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
