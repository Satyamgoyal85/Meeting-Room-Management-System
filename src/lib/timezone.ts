import { format as dateFnsFormat } from 'date-fns';

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Combines a date string (YYYY-MM-DD) and a time string (HH:mm) into an ISO timestamp with explicit IST (+05:30) offset.
 * Example: createIstIsoString("2026-07-06", "15:00") -> "2026-07-06T15:00:00+05:30"
 */
export function createIstIsoString(dateStr: string, timeStr: string): string {
  const timePart = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${timePart}+05:30`;
}

/**
 * Parses any ISO timestamp or Date object into its date and time components in Asia/Kolkata (IST).
 */
export function getIstDateParts(input: string | Date) {
  const date = typeof input === 'string' ? new Date(input) : input;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => {
    const p = parts.find(p => p.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  let hour = getPart('hour');
  if (hour === 24) hour = 0; // Handle 24:00 midnight edge case
  return {
    year: getPart('year'),
    month: getPart('month') - 1, // 0-indexed month for Date constructor
    day: getPart('day'),
    hour,
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

/**
 * Returns a Date object whose local getHours(), getMinutes(), getFullYear(), etc.
 * exactly match the IST time of the given timestamp.
 * This ensures date-fns format() outputs the correct IST time everywhere, regardless of client/server system clock.
 */
export function toIstDate(input: string | Date): Date {
  const { year, month, day, hour, minute, second } = getIstDateParts(input);
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Returns the current date formatted as YYYY-MM-DD in IST relative to a given timestamp or Date.now().
 */
export function getIstDateStr(timestampMs: number = Date.now()): string {
  const date = new Date(timestampMs);
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE });
  return dtf.format(date); // en-CA returns YYYY-MM-DD
}

/**
 * Returns the current time formatted as HH:mm in IST (24-hour format) relative to a given timestamp or Date.now().
 */
export function getIstTimeStr(timestampMs: number = Date.now()): string {
  const { hour, minute } = getIstDateParts(new Date(timestampMs));
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Checks if a given date string (YYYY-MM-DD) and time string (HH:mm) is in the past relative to actual server time in IST.
 */
export function isIstTimeInPast(dateStr: string, timeStr: string, actualServerTimeMs: number = Date.now()): boolean {
  const targetIso = createIstIsoString(dateStr, timeStr);
  return new Date(targetIso).getTime() < actualServerTimeMs;
}

/**
 * Returns the UTC ISO string corresponding to 00:00:00.000 IST for the given date string (YYYY-MM-DD).
 */
export function getStartOfDayIstIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000+05:30`).toISOString();
}

/**
 * Returns the UTC ISO string corresponding to 23:59:59.999 IST for the given date string (YYYY-MM-DD).
 */
export function getEndOfDayIstIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999+05:30`).toISOString();
}

/**
 * Parses a time string (e.g. "13:15") into total minutes from midnight (e.g. 795).
 */
export function parseTimeMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Formats total minutes from midnight (e.g. 795) back to "HH:mm" (e.g. "13:15").
 */
export function formatTimeMinutes(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Computes a sensible new End Time when Start Time is updated.
 * - If oldEndTime > oldStartTime and the duration is <= 12 hours, preserves the exact duration.
 * - Otherwise (or if not previously established), defaults to newStartTime + defaultDurationMinutes (default 15 mins).
 */
export function calculateNextEndTime(newStartTimeStr: string, oldStartTimeStr: string, oldEndTimeStr: string, defaultDurationMinutes: number = 15): string {
  const newStartMins = parseTimeMinutes(newStartTimeStr);
  const oldStartMins = parseTimeMinutes(oldStartTimeStr);
  const oldEndMins = parseTimeMinutes(oldEndTimeStr);
  const oldDuration = oldEndMins - oldStartMins;

  let newEndMins: number;
  if (oldDuration > 0 && oldDuration <= 720) {
    newEndMins = newStartMins + oldDuration;
  } else {
    newEndMins = newStartMins + defaultDurationMinutes;
  }

  // Cap at 23:59 (1439 mins) if it crosses midnight
  if (newEndMins > 1439) {
    newEndMins = 1439;
  }
  return formatTimeMinutes(newEndMins);
}


