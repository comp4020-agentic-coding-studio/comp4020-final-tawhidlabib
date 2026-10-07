import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import type { Person } from "./people";
import { type Event, eventGuests, events, people } from "./schema";
import { clockToUtc } from "./time";

// Events, Facebook-style (ADR 5). Public: anyone with the link can see and
// RSVP, and it's listed on Explore. Private: the host and the people they
// invited, and nobody else. Guests answer going, maybe or can't go; the host
// is going.

export type { Event };
export type Response = "invited" | "going" | "maybe" | "declined" | "waitlisted";
export type Guest = {
  person: Person;
  response: Response;
  invitedBy: number | null;
  plusOnes: number;
  waitlistSeq: number | null;
};

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
    .select({
      person: people,
      response: eventGuests.response,
      invitedBy: eventGuests.invitedBy,
      plusOnes: eventGuests.plusOnes,
      waitlistSeq: eventGuests.waitlistSeq,
    })
    .from(eventGuests)
    .innerJoin(people, eq(people.id, eventGuests.personId))
    .where(eq(eventGuests.eventId, eventId))
    .orderBy(asc(eventGuests.waitlistSeq), asc(people.name))
    .all();
}

/** Spots taken: every going guest and their +1s, the host aside. */
export function spotsTaken(event: Event): number {
  return guestsOf(event.id)
    .filter((g) => g.response === "going" && g.person.id !== event.hostId)
    .reduce((n, g) => n + 1 + g.plusOnes, 0);
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

// Arrival order for the waitlist: strictly increasing within this process,
// even for two taps in the same millisecond.
let lastSeq = 0;
const nextSeq = () => (lastSeq = Math.max(lastSeq + 1, Date.now() * 1000));

/**
 * Answer an event, by the rule in ADR 6. Going takes a spot if one is free
 * (with your +1s, capped at what the host allows); if not, you join the end
 * of the waitlist. Leaving a spot --- maybe, can't go, fewer +1s --- moves
 * the earliest person waiting who fits into it.
 *
 * All of it is one SQLite transaction, and better-sqlite3 runs transactions
 * one at a time, so of two people tapping Going on the last spot at once,
 * exactly one sees it free. Returns your answer as recorded (going or
 * waitlisted) and who was moved in from the waitlist.
 */
export function respond(
  event: Event,
  personId: number,
  response: Exclude<Response, "invited" | "waitlisted">,
  plusOnes = 0,
): { recorded: Response; promoted: number[] } {
  return db.transaction((tx) => {
    const guests = tx
      .select()
      .from(eventGuests)
      .where(eq(eventGuests.eventId, event.id))
      .all();
    const before = guests.find((g) => g.personId === personId);
    const plus = response === "going" ? Math.max(0, Math.min(plusOnes, event.maxPlusOnes)) : 0;
    const taken = guests
      .filter((g) => g.response === "going" && g.personId !== event.hostId && g.personId !== personId)
      .reduce((n, g) => n + 1 + g.plusOnes, 0);

    let recorded: Response = response;
    if (response === "going" && event.capacity !== null && personId !== event.hostId) {
      if (taken + 1 + plus > event.capacity) recorded = "waitlisted";
    }
    // keep your place if you were already waiting
    const waitlistSeq =
      recorded === "waitlisted" ? (before?.response === "waitlisted" ? before.waitlistSeq : nextSeq()) : null;
    const row = { response: recorded, plusOnes: plus, waitlistSeq };
    tx.insert(eventGuests)
      .values({ eventId: event.id, personId, ...row })
      .onConflictDoUpdate({ target: [eventGuests.eventId, eventGuests.personId], set: row })
      .run();

    return { recorded, promoted: fillFromWaitlist(tx, event) };
  });
}

/** After the host raises the spot limit (or anything else frees spots),
 *  move people in from the waitlist. Returns who moved in. */
export function refill(event: Event): number[] {
  return db.transaction((tx) => fillFromWaitlist(tx, event));
}

export function updateEvent(
  id: number,
  fields: Partial<Omit<Event, "id" | "shareId" | "hostId" | "createdAt">>,
): Event {
  return db.update(events).set(fields).where(eq(events.id, id)).returning().get();
}

/** Whether RSVPs have closed: the deadline, in the event's timezone, has
 *  passed. The host can always still answer. */
export function rsvpClosed(event: Event, now = new Date()): boolean {
  if (!event.rsvpByDate || !event.rsvpByTime) return false;
  return clockToUtc(event.rsvpByDate, event.rsvpByTime, event.timezone).getTime() <= now.getTime();
}

/** Spots taken at each of these events: going guests and their +1s, the
 *  host aside. */
export function takenCounts(eventIds: number[]): Map<number, number> {
  const taken = new Map<number, number>();
  if (eventIds.length === 0) return taken;
  const rows = db
    .select({ eventId: eventGuests.eventId, personId: eventGuests.personId, plusOnes: eventGuests.plusOnes, hostId: events.hostId })
    .from(eventGuests)
    .innerJoin(events, eq(events.id, eventGuests.eventId))
    .where(and(inArray(eventGuests.eventId, eventIds), eq(eventGuests.response, "going")))
    .all();
  for (const r of rows) {
    if (r.personId === r.hostId) continue;
    taken.set(r.eventId, (taken.get(r.eventId) ?? 0) + 1 + r.plusOnes);
  }
  return taken;
}

/** Move people from the waitlist into free spots, earliest first; someone
 *  whose party doesn't fit waits while a smaller party behind them goes in. */
function fillFromWaitlist(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], event: Event): number[] {
  if (event.capacity === null) return [];
  const promoted: number[] = [];
  const guests = tx.select().from(eventGuests).where(eq(eventGuests.eventId, event.id)).all();
  let free =
    event.capacity -
    guests
      .filter((g) => g.response === "going" && g.personId !== event.hostId)
      .reduce((n, g) => n + 1 + g.plusOnes, 0);
  const waiting = guests
    .filter((g) => g.response === "waitlisted")
    .sort((a, b) => (a.waitlistSeq ?? 0) - (b.waitlistSeq ?? 0));
  for (const g of waiting) {
    if (1 + g.plusOnes > free) continue;
    tx.update(eventGuests)
      .set({ response: "going", waitlistSeq: null })
      .where(and(eq(eventGuests.eventId, event.id), eq(eventGuests.personId, g.personId)))
      .run();
    free -= 1 + g.plusOnes;
    promoted.push(g.personId);
  }
  return promoted;
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

/** Upcoming public events, for Explore: soonest first, optionally only
 *  those whose title or place matches a search, or within a date range. */
export function publicEvents(fromDate: string, limit = 30, search = "", toDate?: string): Event[] {
  const words = search.trim().toLowerCase();
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.visibility, "public"),
        gte(events.date, fromDate),
        toDate ? lte(events.date, toDate) : undefined,
        words
          ? or(like(sql`lower(${events.title})`, `%${words}%`), like(sql`lower(${events.location})`, `%${words}%`))
          : undefined,
      ),
    )
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
