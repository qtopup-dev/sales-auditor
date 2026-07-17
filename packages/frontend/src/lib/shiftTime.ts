// This app's moderators and admins operate in the Philippines. CLAUDE.md Rule 7 (UTC
// everywhere) governs storage/transport (MySQL, Prisma, Node process) — it does not mean
// UI displays should show raw UTC clock components to users. All shift-related time/date
// displays must reflect Asia/Manila (UTC+8, no DST) wall-clock time so a moderator who
// clocked in at 9:03 AM PH time sees "9:03 AM", not "1:03 AM".
const PH_TIME_ZONE = 'Asia/Manila';

export function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export function formatShiftDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function phTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// e.g. "Saturday July 18, 2026"
export function formatLongDatePH(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: PH_TIME_ZONE, weekday: 'long' }).format(date);
  const monthDayYear = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  return `${weekday} ${monthDayYear}`;
}
