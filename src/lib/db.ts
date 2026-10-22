import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
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
import { nameKey } from "./names";

// One SQLite file is the app's whole persistent state. In production the
// Dockerfile points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
//
// Foreign keys are OFF while migrating, and that has to be set here, not in
// the migration. A migration that changes a column's foreign key rebuilds
// its table (create new, copy, DROP old, rename), and drizzle-kit writes
// `PRAGMA foreign_keys=OFF` around that --- but drizzle runs every migration
// inside one transaction, and SQLite ignores that pragma inside a
// transaction. With keys on, `DROP TABLE hangouts` cascade-deletes every
// RSVP, comment, poll and photo on every plan. (Caught in review before it
// shipped: spec/migrations.test.ts holds it.) So: off before the
// transaction starts, back on after, and refuse to start if anything was
// left pointing at nothing.
client.pragma("foreign_keys = OFF");
migrate(db, { migrationsFolder: "./drizzle" });
const dangling = client.pragma("foreign_key_check") as unknown[];
client.pragma("foreign_keys = ON");
if (dangling.length > 0) {
  throw new Error(`migrations left ${dangling.length} row(s) pointing at nothing: refusing to start`);
}

// On the way down --- a deploy, Fly stopping an idle machine (SIGTERM), Ctrl+C
// (SIGINT) --- fold the write-ahead log back into the database file and
// close it, so the volume holds one whole file rather than a file and a log.
// A handler replaces Node's default of exiting, so this exits itself. Here,
// beside the client: the database opens with the first request, and before
// that there's nothing to close. Once per process, since the dev server can
// load this module again.
const SHUTDOWN = Symbol.for("hangout.db.shutdown");
const proc = process as NodeJS.Process & { [SHUTDOWN]?: true };
if (!proc[SHUTDOWN]) {
  proc[SHUTDOWN] = true;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      try {
        client.pragma("wal_checkpoint(TRUNCATE)");
        client.close();
      } catch {
        // best effort: SQLite replays the WAL on the next open anyway
      }
      process.exit(0);
    });
  }
}

/** Whether the database answers: the health check's question. */
export function healthy(): boolean {
  try {
    return client.prepare("SELECT 1 AS ok").get() !== undefined;
  } catch {
    return false;
  }
}

export type { Group, Hangout, Member, Rsvp };

/** Unguessable, URL-safe ids: the group id is the invite secret and the
 *  member token is the cookie, so neither can be a counter. */
const secret = (bytes: number) => randomBytes(bytes).toString("base64url");

export function getGroup(id: string): Group | undefined {
  return db.select().from(groups).where(eq(groups.id, id)).get();
}

export function createGroup(input: {
  name: string;
  timezone: string;
  you: string;
  personId?: number;
}): {
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
      .values({
        groupId: group.id,
        name: input.you,
        nameKey: nameKey(input.you),
        token: secret(24),
        personId: input.personId,
      })
      .returning()
      .get();
    // whoever starts a group is its admin
    tx.update(groups).set({ adminId: member.id }).where(eq(groups.id, group.id)).run();
    return { group: { ...group, adminId: member.id }, member };
  });
}

/** A new member, or undefined if someone in the group already goes by that
 *  name. */
export function addMember(groupId: string, name: string, personId?: number): Member | undefined {
  const taken = db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.nameKey, nameKey(name))))
    .get();
  if (taken) return undefined;
  return db
    .insert(members)
    .values({ groupId, name, nameKey: nameKey(name), token: secret(24), personId })
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
    // the same hour twice in one save is one hour
    const hours = [...new Map(free.map((f) => [`${f.date}T${f.hour}`, f])).values()];
    if (hours.length > 0) {
      tx.insert(availability)
        .values(hours.map((f) => ({ memberId, ...f })))
        .run();
    }
  });
}

export function getHangout(id: number): Hangout | undefined {
  return db.select().from(hangouts).where(eq(hangouts.id, id)).get();
}

/** Propose a hangout; whoever proposes it is in. */
export function proposeHangout(input: Omit<Hangout, "id" | "createdAt" | "proposedBy"> & { proposedBy: number }): { hangout: Hangout; existed: boolean } {
  // Two people often propose the same best time at once --- it's the one the
  // page recommends to both. The same date and hours in the same group is the
  // same plan: the second proposer joins the first's (in), rather than making
  // a duplicate. One transaction, so the check and the write can't be split
  // by a simultaneous proposal (see ADR 6 for why that's enough).
  return db.transaction((tx) => {
    const same = tx
      .select()
      .from(hangouts)
      .where(
        and(
          eq(hangouts.groupId, input.groupId),
          eq(hangouts.date, input.date),
          eq(hangouts.startHour, input.startHour),
          eq(hangouts.endHour, input.endHour),
        ),
      )
      .get();
    const hangout = same ?? tx.insert(hangouts).values(input).returning().get();
    tx.insert(rsvps)
      .values({ hangoutId: hangout.id, memberId: input.proposedBy, response: "in" })
      .onConflictDoUpdate({ target: [rsvps.hangoutId, rsvps.memberId], set: { response: "in" } })
      .run();
    return { hangout, existed: !!same };
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

/** The group's hangouts before `beforeDate`, most recent first. */
export function pastHangouts(groupId: string, beforeDate: string, limit = 10): Hangout[] {
  return db
    .select()
    .from(hangouts)
    .where(and(eq(hangouts.groupId, groupId), lt(hangouts.date, beforeDate)))
    .orderBy(desc(hangouts.date), desc(hangouts.startHour))
    .limit(limit)
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
