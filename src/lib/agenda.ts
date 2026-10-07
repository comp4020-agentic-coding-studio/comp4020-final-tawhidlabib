import { rsvpsFor, upcomingHangouts } from "./db";
import { eventsFor } from "./events";
import { groupsFor } from "./identity";
import type { Person } from "./people";
import { clockLabel, hourLabel, weekStartOf } from "./time";

// Everything someone has on, in one list: hangouts from every group they're
// in and events they host or are invited to, soonest first. The calendar
// and the home page both read from here.

export type AgendaItem = {
  kind: "hangout" | "event";
  date: string;
  /** "HH:MM", for ordering within a day. */
  start: string;
  time: string;
  title: string;
  /** The group's name, or the event's location. */
  where: string;
  href: string;
  status: "in" | "out" | "unanswered" | "hosting" | "going" | "maybe" | "invited" | "declined" | "waitlisted";
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Plans from `from` on, up to `to` if given. */
export function agendaFor(
  person: Person | undefined,
  cookieHeader: string | null,
  from: string,
  to?: string,
): AgendaItem[] {
  const items: AgendaItem[] = [];
  const within = (date: string) => date >= from && (!to || date <= to);

  for (const { group, member } of groupsFor(person, cookieHeader)) {
    const plans = upcomingHangouts(group.id, from).filter((h) => within(h.date));
    const answers = rsvpsFor(plans.map((p) => p.id));
    for (const h of plans) {
      const mine = answers.find((a) => a.hangoutId === h.id && a.memberId === member.id);
      items.push({
        kind: "hangout",
        date: h.date,
        start: `${pad(h.startHour)}:00`,
        time: `${hourLabel(h.startHour)}–${hourLabel(h.endHour)}`,
        title: h.title,
        where: group.name,
        href: `/g/${group.id}?week=${weekStartOf(h.date)}#plans`,
        status: mine?.response ?? "unanswered",
      });
    }
  }

  if (person) {
    for (const { event, response } of eventsFor(person.id, from)) {
      if (!within(event.date)) continue;
      items.push({
        kind: "event",
        date: event.date,
        start: event.startTime,
        time: `${clockLabel(event.startTime)}–${clockLabel(event.endTime)}`,
        title: event.title,
        where: event.location,
        href: `/e/${event.shareId}`,
        status: event.hostId === person.id ? "hosting" : response,
      });
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** Plans someone is actually going to (or still has to answer). */
export const upcoming = (items: AgendaItem[]) =>
  items.filter((i) => i.status !== "out" && i.status !== "declined");
