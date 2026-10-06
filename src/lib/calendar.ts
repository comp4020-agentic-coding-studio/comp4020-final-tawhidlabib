import type { Group, Hangout } from "./schema";
import { wallTimeToUtc } from "./time";

// Getting a hangout into someone's calendar without signing them in to
// anything: a pre-filled Google Calendar event they save with one click, and
// an .ics file for Apple, Outlook and everything else. Both carry UTC
// instants, so neither depends on the calendar guessing the group's zone.

export type CalendarEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  url: string;
};

/** A hangout as a calendar event, its hours read in the group's timezone. */
export function hangoutEvent(hangout: Hangout, group: Group, origin: string): CalendarEvent {
  return {
    uid: `hangout-${hangout.id}-${group.id}@hangout`,
    title: hangout.title,
    start: wallTimeToUtc(hangout.date, hangout.startHour, group.timezone),
    end: wallTimeToUtc(hangout.date, hangout.endHour, group.timezone),
    description: `With ${group.name}, planned on Hangout.`,
    url: new URL(`/g/${group.id}`, origin).href,
  };
}

/** 2030-01-08T08:00:00.000Z → 20300108T080000Z, the form both formats use. */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(event: CalendarEvent): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set("dates", `${stamp(event.start)}/${stamp(event.end)}`);
  url.searchParams.set("details", `${event.description}\n${event.url}`);
  return url.href;
}

/** RFC 5545 TEXT escaping. */
const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 caps content lines at 75 octets; longer ones continue on a line
 *  starting with a space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = chunks.length === 0 ? 75 : 74;
    if (Buffer.byteLength(current + char, "utf8") > limit) {
      chunks.push(current);
      current = "";
    }
    current += char;
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

export function ics(event: CalendarEvent, now = new Date()): string {
  return `${[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hangout//Hangout//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")}\r\n`;
}
