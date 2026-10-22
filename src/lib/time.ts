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

/** How far from this week a week can be and still be shown or saved: ten
 *  years either way, as a nudge already allows. Past that, a date runs off
 *  the end of what Date and Intl can read (year 9999), and nobody plans
 *  there anyway. */
export const WEEKS_IN_REACH = 520;

/** Whether a date is a Monday within reach of this week. */
export function isWeekInReach(week: string, tz: string, now = new Date()): boolean {
  if (!isDate(week) || weekStartOf(week) !== week) return false;
  const thisWeek = currentWeekStart(tz, now);
  return week >= addDays(thisWeek, -7 * WEEKS_IN_REACH) && week <= addDays(thisWeek, 7 * WEEKS_IN_REACH);
}

/** The week a `?week=` asks for, when it names a Monday in reach; this week
 *  otherwise. */
export function weekParam(asked: string, tz: string, now = new Date()): string {
  return isWeekInReach(asked, tz, now) ? asked : currentWeekStart(tz, now);
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

/** The date an event ends on. An end at or before its start runs into the
 *  next day: 22:00–01:00 is a late one, not a mistake. */
export const endDate = (date: string, start: string, end: string) => (end <= start ? addDays(date, 1) : date);

/** "7pm–9:30pm", or "10pm–1am (next day)" for one that runs past midnight. */
export function clockSpan(start: string, end: string): string {
  return `${clockLabel(start)}–${clockLabel(end)}${end <= start ? " (next day)" : ""}`;
}

/** "Today", "Tomorrow", "In 5 days": how far off a date is, for a glance.
 *  A date that has gone is "Past", never "Today". */
export function relativeDay(date: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/** The slot key the grid's checkboxes carry: "2030-01-08T18". */
export const slotKey = (date: string, hour: number) => `${date}T${pad(hour)}`;

export const isMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

/** "2030-01" → "2030-02" (or back, with a negative n). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}

/** The month a `?month=` asks for, when it's within ten years of today's;
 *  today's otherwise. Year 0 has to be kept out: addDays writes the day
 *  before it as "-000001-12-31", which sorts below every real date, and
 *  monthGrid's loop never reaches its end. */
export function monthParam(asked: string, today: string): string {
  const month = today.slice(0, 7);
  if (!isMonth(asked)) return month;
  return asked >= addMonths(month, -12 * 10) && asked <= addMonths(month, 12 * 10) ? asked : month;
}

/** "2030-01" → "January 2030". */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/** Every date a month's calendar grid shows: whole weeks, Monday first. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const start = weekStartOf(first);
  const end = addDays(weekStartOf(last), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
