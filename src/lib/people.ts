import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import { type Group, groups, type Member, members, type Person, people } from "./schema";

// Profiles: a person across every group they're in (ADR 4). The token is
// both their cookie and their private sign-in link, so whoever holds it is
// them; making a new one signs every other device out.

export type { Person };

const secret = (bytes: number) => randomBytes(bytes).toString("base64url");

export function personByToken(token: string): Person | undefined {
  return db.select().from(people).where(eq(people.token, token)).get();
}

export function personByCode(code: string): Person | undefined {
  return db.select().from(people).where(eq(people.friendCode, code)).get();
}

export function personById(id: number): Person | undefined {
  return db.select().from(people).where(eq(people.id, id)).get();
}

export function peopleByIds(ids: number[]): Person[] {
  if (ids.length === 0) return [];
  return db.select().from(people).where(inArray(people.id, ids)).all();
}

export function createPerson(input: { name: string; timezone: string }): Person {
  return db
    .insert(people)
    .values({ ...input, token: secret(24), friendCode: secret(8) })
    .returning()
    .get();
}

export function renamePerson(id: number, name: string): void {
  db.update(people).set({ name }).where(eq(people.id, id)).run();
}

/** A fresh sign-in link; the old one (and every device using it) stops
 *  working. */
export function newToken(id: number): Person {
  return db.update(people).set({ token: secret(24) }).where(eq(people.id, id)).returning().get();
}

/** Link memberships made before this person had a profile to it. Only ever
 *  claims unclaimed ones. */
export function claimMembers(personId: number, memberIds: number[]): void {
  if (memberIds.length === 0) return;
  db.update(members)
    .set({ personId })
    .where(and(inArray(members.id, memberIds), isNull(members.personId)))
    .run();
}

export function memberOfPerson(groupId: string, personId: number): Member | undefined {
  return db
    .select()
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.personId, personId)))
    .get();
}

/** Every group a person belongs to, with their membership in each. */
export function groupsOfPerson(personId: number): { group: Group; member: Member }[] {
  return db
    .select({ group: groups, member: members })
    .from(members)
    .innerJoin(groups, eq(groups.id, members.groupId))
    .where(eq(members.personId, personId))
    .all();
}
