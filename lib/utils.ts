// lib/utils.ts — shared date helpers and error utilities used across all screens

/** Today's date as YYYY-MM-DD. */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/** Converts a Date to YYYY-MM-DD without timezone shift. */
export function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** "May 9" label — parses ISO components directly to avoid timezone offset. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Wed, May 6, 2026" label for history rows. */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** "Wednesday, May 6" heading for day-detail modals. */
export function formatFullDate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

/** Extracts a string message from an unknown catch value. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}
