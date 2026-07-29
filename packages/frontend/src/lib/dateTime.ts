// This app stores and transmits all timestamps in UTC (CLAUDE.md Rule 7). This formatter
// displays that UTC value as-is (no timezone conversion) using a humanized long-date format,
// e.g. "July 29, 2026, 2:32 PM" — used across the Sales sheets and Audit Drawer (Phase 11 D-01/D-02).
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${datePart}, ${timePart}`;
}
