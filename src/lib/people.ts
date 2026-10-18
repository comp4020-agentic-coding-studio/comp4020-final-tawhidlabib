import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "./db";
import { publish } from "./live";
import {
  comments,
  eventGuests,
  events,
  friendships,
  type Group,
  groups,
  type Member,
  members,
  type Person,
  people,
  photos,
  pollVotes,
  polls,
  ratings,
  reactions,
} from "./schema";

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

/** Every live topic whose page shows this person's name or avatar: their
 *  groups, the events they host or answered, the plan threads they spoke or
 *  voted in, and their friends' own pages. Topics only, never the data. */
export function topicsShowing(personId: number): string[] {
  const topics = new Set<string>();
  for (const { group } of groupsOfPerson(personId)) topics.add(`group:${group.id}`);

  const shareIds = db
    .select({ shareId: events.shareId })
    .from(events)
    .leftJoin(eventGuests, eq(eventGuests.eventId, events.id))
    .where(or(eq(events.hostId, personId), eq(eventGuests.personId, personId)))
    .all();
  for (const { shareId } of shareIds) topics.add(`event:${shareId}`);

  // a thread is wherever they commented, reacted, rated, added a photo or voted
  const spoke = [
    ...db.select({ e: comments.eventId, h: comments.hangoutId }).from(comments).where(eq(comments.authorId, personId)).all(),
    ...db.select({ e: reactions.eventId, h: reactions.hangoutId }).from(reactions).where(eq(reactions.personId, personId)).all(),
    ...db.select({ e: ratings.eventId, h: ratings.hangoutId }).from(ratings).where(eq(ratings.personId, personId)).all(),
    ...db.select({ e: photos.eventId, h: photos.hangoutId }).from(photos).where(eq(photos.uploaderId, personId)).all(),
    ...db
      .select({ e: polls.eventId, h: polls.hangoutId })
      .from(pollVotes)
      .innerJoin(polls, eq(polls.id, pollVotes.pollId))
      .where(eq(pollVotes.personId, personId))
      .all(),
  ];
  const eventIds = [...new Set(spoke.map((r) => r.e).filter((id): id is number => id !== null))];
  if (eventIds.length > 0) {
    for (const r of db.select({ shareId: events.shareId }).from(events).where(inArray(events.id, eventIds)).all()) {
      topics.add(`thread:event:${r.shareId}`);
    }
  }
  for (const r of spoke) if (r.h !== null) topics.add(`thread:hangout:${r.h}`);

  for (const f of db
    .select()
    .from(friendships)
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, personId), eq(friendships.addresseeId, personId))))
    .all()) {
    topics.add(`person:${f.requesterId === personId ? f.addresseeId : f.requesterId}`);
  }
  return [...topics];
}

/** Tell every open page that shows this person that they changed. */
export function publishPersonChanged(personId: number, what: string): void {
  for (const topic of topicsShowing(personId)) publish(topic, what);
}
