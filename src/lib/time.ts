// Dates are plain "YYYY-MM-DD" strings and hours are whole numbers on a 24h
// clock, both meaning wall-clock time in the group's timezone. Only a
// calendar export needs a real instant, and wallTimeToUtc is the one place
// that conversion happens.

/** The grid's first and last bookable hours: 8:00 to 23:00, the last ending
 *  at midnight. */
export const FIRST_HOUR = 8;
export const LAST_HOUR = 23;
export const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

export const DEFAULT_TIMEZONE = "Australia/Sydney";

const pad = (n: number) => String(n).padStart(2, "0");

export function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

/** The wall-clock fields of an instant, as seen in a timezone. */
function zoned(instant: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const field = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: field("year"),
    month: field("month"),
    day: field("day"),
    hour: field("hour"),
    minute: field("minute"),
  };
}

/** The instant a wall-clock hour on a date names in a timezone. Guess as if
 *  the zone were UTC, see how far off that reads in the zone, and correct;
 *  the second pass settles the guesses that straddle a daylight-saving
 *  change. */
export function wallTimeToUtc(date: string, hour: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d, hour);
  let t = target;
  for (let i = 0; i < 2; i++) {
    const z = zoned(new Date(t), tz);
    t += target - Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
  }
  return new Date(t);
}

export function todayIn(tz: string, now = new Date()): string {
  const z = zoned(now, tz);
  return `${z.year}-${pad(z.month)}-${pad(z.day)}`;
}

export function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** The Monday of the week a date falls in. */
export function weekStartOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

export function currentWeekStart(tz: string, now = new Date()): string {
  return weekStartOf(todayIn(tz, now));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Whether an hour slot has already begun, so it's no use recommending. */
export function hasStarted(date: string, hour: number, tz: string, now = new Date()): boolean {
  return wallTimeToUtc(date, hour, tz).getTime() <= now.getTime();
}

/** "Tue 8 Jan". Built from parts: en-AU's own format puts a comma after the
 *  weekday, and the grid header splits this on spaces. */
export function dayLabel(date: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/** "6pm", "12pm", "12am" for midnight (24). */
export function hourLabel(hour: number): string {
  const h = hour % 24;
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

/** "Tue 8 Jan, 6pm–10pm". */
export function spanLabel(date: string, start: number, end: number): string {
  return `${dayLabel(date)}, ${hourLabel(start)}–${hourLabel(end)}`;
}

export const isClock = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

/** The instant an "HH:MM" wall-clock time on a date names in a timezone. */
export function clockToUtc(date: string, time: string, tz: string): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(wallTimeToUtc(date, h, tz).getTime() + m * 60_000);
}

/** "19:00" → "7pm", "19:30" → "7:30pm". */
export function clockLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return m === 0 ? hourLabel(h) : hourLabel(h).replace(/(am|pm)$/, `:${String(m).padStart(2, "0")}$1`);
}

/** "Today", "Tomorrow", "In 5 days": how far off a date is, for a glance. */
export function relativeDay(date: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/** The slot key the grid's checkboxes carry: "2030-01-08T18". */
export const slotKey = (date: string, hour: number) => `${date}T${pad(hour)}`;
