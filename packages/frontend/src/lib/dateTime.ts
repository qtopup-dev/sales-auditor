// This app stores and transmits all timestamps in UTC (CLAUDE.md Rule 7 — storage/transport
// only). Moderators and admins operate in the Philippines, so every display of a timestamp
// converts to Asia/Manila (UTC+8, no DST) wall-clock time, humanized long-date format,
// e.g. "July 29, 2026, 10:32 PM" — used across the Sales sheets and Audit Drawer (Phase 11 D-01/D-02).
const PH_TIME_ZONE = 'Asia/Manila';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${datePart}, ${timePart}`;
}
