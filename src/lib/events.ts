import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "./db";
import type { Person } from "./people";
import { type Event, eventGuests, events, people } from "./schema";

// Events, Facebook-style (ADR 5). Public: anyone with the link can see and
// RSVP, and it's listed on Explore. Private: the host and the people they
// invited, and nobody else. Guests answer going, maybe or can't go; the host
// is going.

export type { Event };
export type Response = "invited" | "going" | "maybe" | "declined";
export type Guest = { person: Person; response: Response; invitedBy: number | null };

export function eventByShareId(shareId: string): Event | undefined {
  return db.select().from(events).where(eq(events.shareId, shareId)).get();
}

export function createEvent(
  input: Omit<Event, "id" | "shareId" | "hostId" | "createdAt">,
  hostId: number,
  inviteIds: number[],
): Event {
  return db.transaction((tx) => {
    const event = tx
      .insert(events)
      .values({ ...input, hostId, shareId: randomBytes(9).toString("base64url") })
      .returning()
      .get();
    tx.insert(eventGuests).values({ eventId: event.id, personId: hostId, response: "going" }).run();
    const guests = [...new Set(inviteIds)].filter((id) => id !== hostId);
    if (guests.length > 0) {
      tx.insert(eventGuests)
        .values(guests.map((personId) => ({ eventId: event.id, personId, invitedBy: hostId, response: "invited" as const })))
        .onConflictDoNothing()
        .run();
    }
    return event;
  });
}

export function guestsOf(eventId: number): Guest[] {
  return db
    .select({ person: people, response: eventGuests.response, invitedBy: eventGuests.invitedBy })
    .from(eventGuests)
    .innerJoin(people, eq(people.id, eventGuests.personId))
    .where(eq(eventGuests.eventId, eventId))
    .orderBy(asc(people.name))
    .all();
}

export function responseOf(eventId: number, personId: number): Response | undefined {
  return db
    .select({ response: eventGuests.response })
    .from(eventGuests)
    .where(and(eq(eventGuests.eventId, eventId), eq(eventGuests.personId, personId)))
    .get()?.response;
}

/** Whether someone (or a stranger, with no profile) may see an event. */
export function canSee(event: Event, person: Person | undefined): boolean {
  if (event.visibility === "public") return true;
  if (!person) return false;
  return event.hostId === person.id || responseOf(event.id, person.id) !== undefined;
}

export function respond(eventId: number, personId: number, response: Exclude<Response, "invited">): void {
  db.insert(eventGuests)
    .values({ eventId, personId, response })
    .onConflictDoUpdate({ target: [eventGuests.eventId, eventGuests.personId], set: { response } })
    .run();
}

export function invite(eventId: number, by: number, personIds: number[]): void {
  const ids = [...new Set(personIds)];
  if (ids.length === 0) return;
  db.insert(eventGuests)
    .values(ids.map((personId) => ({ eventId, personId, invitedBy: by, response: "invited" as const })))
    .onConflictDoNothing()
    .run();
}

export function cancelEvent(eventId: number): void {
  db.delete(events).where(eq(events.id, eventId)).run();
}

/** Events someone hosts or has been invited to or answered, from a date on. */
export function eventsFor(personId: number, fromDate: string): { event: Event; response: Response }[] {
  return db
    .select({ event: events, response: eventGuests.response })
    .from(eventGuests)
    .innerJoin(events, eq(events.id, eventGuests.eventId))
    .where(and(eq(eventGuests.personId, personId), gte(events.date, fromDate)))
    .orderBy(asc(events.date), asc(events.startTime))
    .all();
}

/** Upcoming public events, for Explore. */
export function publicEvents(fromDate: string, limit = 30): Event[] {
  return db
    .select()
    .from(events)
    .where(and(eq(events.visibility, "public"), gte(events.date, fromDate)))
    .orderBy(asc(events.date), asc(events.startTime))
    .limit(limit)
    .all();
}

export function unansweredCount(personId: number, fromDate: string): number {
  return eventsFor(personId, fromDate).filter((e) => e.response === "invited").length;
}

/** How many are going to each of these events. */
export function goingCounts(eventIds: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  if (eventIds.length === 0) return counts;
  const rows = db
    .select({ eventId: eventGuests.eventId })
    .from(eventGuests)
    .where(and(inArray(eventGuests.eventId, eventIds), eq(eventGuests.response, "going")))
    .all();
  for (const r of rows) counts.set(r.eventId, (counts.get(r.eventId) ?? 0) + 1);
  return counts;
}

export function eventById(id: number): Event | undefined {
  return db.select().from(events).where(eq(events.id, id)).get();
}
