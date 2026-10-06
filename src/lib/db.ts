import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  availability,
  type Group,
  groups,
  type Hangout,
  hangouts,
  type Member,
  members,
  type Rsvp,
  rsvps,
} from "./schema";

// One SQLite file is the app's whole persistent state. In production the
// Dockerfile points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");
client.pragma("foreign_keys = ON");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Group, Hangout, Member, Rsvp };

/** Unguessable, URL-safe ids: the group id is the invite secret and the
 *  member token is the cookie, so neither can be a counter. */
const secret = (bytes: number) => randomBytes(bytes).toString("base64url");

const nameKey = (name: string) => name.trim().toLowerCase();

export function getGroup(id: string): Group | undefined {
  return db.select().from(groups).where(eq(groups.id, id)).get();
}

export function createGroup(input: { name: string; timezone: string; you: string }): {
  group: Group;
  member: Member;
} {
  return db.transaction((tx) => {
    const group = tx
      .insert(groups)
      .values({ id: secret(9), name: input.name, timezone: input.timezone })
      .returning()
      .get();
    const member = tx
      .insert(members)
      .values({ groupId: group.id, name: input.you, nameKey: nameKey(input.you), token: secret(24) })
      .returning()
      .get();
    return { group, member };
  });
}

/** A new member, or undefined if someone in the group already goes by that
 *  name. */
export function addMember(groupId: string, name: string): Member | undefined {
  const taken = db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.nameKey, nameKey(name))))
    .get();
  if (taken) return undefined;
  return db
    .insert(members)
    .values({ groupId, name, nameKey: nameKey(name), token: secret(24) })
    .returning()
    .get();
}

export function memberByToken(groupId: string, token: string): Member | undefined {
  return db
    .select()
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.token, token)))
    .get();
}

export function listMembers(groupId: string): Member[] {
  return db
    .select()
    .from(members)
    .where(eq(members.groupId, groupId))
    .orderBy(asc(members.id))
    .all();
}

/** Every free hour any member of the group has marked on the given dates. */
export function availabilityOn(
  groupId: string,
  dates: string[],
): { memberId: number; date: string; hour: number }[] {
  return db
    .select({ memberId: availability.memberId, date: availability.date, hour: availability.hour })
    .from(availability)
    .innerJoin(members, eq(members.id, availability.memberId))
    .where(and(eq(members.groupId, groupId), inArray(availability.date, dates)))
    .all();
}

/** Replace one member's free hours across the given dates with `free`. A
 *  submitted week is the whole answer for that week, so unticking an hour
 *  has to remove it. */
export function setAvailability(
  memberId: number,
  dates: string[],
  free: { date: string; hour: number }[],
): void {
  db.transaction((tx) => {
    tx.delete(availability)
      .where(and(eq(availability.memberId, memberId), inArray(availability.date, dates)))
      .run();
    if (free.length > 0) {
      tx.insert(availability)
        .values(free.map((f) => ({ memberId, ...f })))
        .run();
    }
  });
}

export function getHangout(id: number): Hangout | undefined {
  return db.select().from(hangouts).where(eq(hangouts.id, id)).get();
}

/** Propose a hangout; whoever proposes it is in. */
export function proposeHangout(input: Omit<Hangout, "id" | "createdAt">): Hangout {
  return db.transaction((tx) => {
    const hangout = tx.insert(hangouts).values(input).returning().get();
    tx.insert(rsvps)
      .values({ hangoutId: hangout.id, memberId: input.proposedBy, response: "in" })
      .run();
    return hangout;
  });
}

/** The group's hangouts from `fromDate` on, soonest first. */
export function upcomingHangouts(groupId: string, fromDate: string): Hangout[] {
  return db
    .select()
    .from(hangouts)
    .where(and(eq(hangouts.groupId, groupId), gte(hangouts.date, fromDate)))
    .orderBy(asc(hangouts.date), asc(hangouts.startHour), asc(hangouts.id))
    .all();
}

export function rsvpsFor(hangoutIds: number[]): Rsvp[] {
  if (hangoutIds.length === 0) return [];
  return db.select().from(rsvps).where(inArray(rsvps.hangoutId, hangoutIds)).all();
}

export function setRsvp(hangoutId: number, memberId: number, response: "in" | "out"): void {
  db.insert(rsvps)
    .values({ hangoutId, memberId, response })
    .onConflictDoUpdate({ target: [rsvps.hangoutId, rsvps.memberId], set: { response } })
    .run();
}
