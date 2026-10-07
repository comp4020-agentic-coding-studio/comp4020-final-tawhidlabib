import type { AstroCookies } from "astro";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db, getGroup, getHangout, listMembers } from "./db";
import { blockedBy } from "./blocks";
import { canSee, eventById, eventByShareId, guestsOf } from "./events";
import { currentMember, currentPerson } from "./identity";
import type { Person } from "./people";
import { comments, people, reactions } from "./schema";
import { todayIn, weekStartOf } from "./time";

// Comments and reactions on a plan --- an event or a hangout. The talk lives
// with the plan, and only the people it's for can join in: an event's guests
// (anyone with a profile, for a public one), a hangout's group.

export const REACTIONS = [
  { emoji: "👍", name: "Thumbs up" },
  { emoji: "❤️", name: "Love" },
  { emoji: "😂", name: "Haha" },
  { emoji: "🎉", name: "Party" },
  { emoji: "😮", name: "Wow" },
  { emoji: "🙌", name: "Yes!" },
] as const;
export const isReaction = (value: unknown) => REACTIONS.some((r) => r.emoji === value);

export type Kind = "event" | "hangout";
export type Target = { kind: Kind; id: number };

/** A plan's thread, as one visitor may use it. */
export type Thread = {
  target: Target;
  kind: Kind;
  /** The public reference forms use: an event's share id, a hangout's id. */
  ref: string;
  /** Where the plan is shown, for redirects back to it. */
  page: string;
  person: Person | undefined;
  /** May see the thread at all. */
  visible: boolean;
  /** May comment and react: can see it, and has a profile to speak as. */
  canTalk: boolean;
  /** Besides authors, who may delete comments: an event's host. */
  moderatorId: number | null;
  /** The plan's name, for notifications. */
  title: string;
  /** Whether the plan's day has come (in its timezone): its album opens. */
  arrived: boolean;
  /** A hangout's group, so its notifications respect muting. */
  groupId?: string;
  /** Everyone the plan is for: an event's host and guests (not those who
   *  can't go), a hangout's group. */
  audience: () => number[];
};

const column = (kind: Kind, table: typeof comments | typeof reactions) =>
  kind === "event" ? table.eventId : table.hangoutId;
const targetValues = (t: Target) => (t.kind === "event" ? { eventId: t.id } : { hangoutId: t.id });

/** Find the plan a form or a partial names, and what this visitor may do. */
export function openThread(kind: string, ref: string, cookies: AstroCookies): Thread | undefined {
  const person = currentPerson(cookies);
  if (kind === "event") {
    const event = eventByShareId(ref);
    if (!event) return undefined;
    const visible = canSee(event, person);
    return {
      target: { kind, id: event.id },
      kind,
      ref,
      page: `/e/${event.shareId}`,
      person,
      visible,
      canTalk: visible && !!person,
      moderatorId: event.hostId,
      title: event.title,
      arrived: event.date <= todayIn(event.timezone),
      audience: () => [
        event.hostId,
        ...guestsOf(event.id)
          .filter((g) => g.response !== "declined")
          .map((g) => g.person.id),
      ],
    };
  }
  if (kind === "hangout") {
    const hangout = getHangout(Number(ref));
    if (!hangout) return undefined;
    const visible = !!currentMember(cookies, hangout.groupId);
    // an archived group's plans can be read, not added to
    const archived = getGroup(hangout.groupId)?.archivedAt != null;
    return {
      target: { kind, id: hangout.id },
      kind,
      ref: String(hangout.id),
      page: `/g/${hangout.groupId}?week=${weekStartOf(hangout.date)}#plans`,
      person,
      visible,
      canTalk: visible && !!person && !archived,
      moderatorId: null,
      title: hangout.title,
      groupId: hangout.groupId,
      arrived: hangout.date <= todayIn(getGroup(hangout.groupId)?.timezone ?? "Australia/Sydney"),
      audience: () =>
        listMembers(hangout.groupId)
          .map((m) => m.personId)
          .filter((id): id is number => id !== null),
    };
  }
  return undefined;
}

/** A plan's thread, found from the plan itself rather than a form. */
export function threadFor(target: Target, cookies: AstroCookies): Thread | undefined {
  return target.kind === "event"
    ? openThread("event", eventById(target.id)?.shareId ?? "", cookies)
    : openThread("hangout", String(target.id), cookies);
}

export type Said = { id: number; body: string; createdAt: string; author: Person };

export function commentsOn(target: Target, viewerId?: number): Said[] {
  const hidden = viewerId ? blockedBy(viewerId) : new Set<number>();
  return db
    .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, author: people })
    .from(comments)
    .innerJoin(people, eq(people.id, comments.authorId))
    .where(eq(column(target.kind, comments), target.id))
    .orderBy(asc(comments.id))
    .all()
    .filter((c) => !hidden.has(c.author.id));
}

export function addComment(target: Target, authorId: number, body: string): void {
  db.insert(comments)
    .values({ ...targetValues(target), authorId, body })
    .run();
}

export function commentById(id: number) {
  return db.select().from(comments).where(eq(comments.id, id)).get();
}

export function deleteComment(id: number): void {
  db.delete(comments).where(eq(comments.id, id)).run();
}

/** Each reaction's count and who gave it, and the visitor's own. */
export function reactionsOn(
  target: Target,
  personId: number | undefined,
): { emoji: string; name: string; who: string[]; mine: boolean }[] {
  const rows = db
    .select({ emoji: reactions.emoji, personId: reactions.personId, name: people.name })
    .from(reactions)
    .innerJoin(people, eq(people.id, reactions.personId))
    .where(eq(column(target.kind, reactions), target.id))
    .orderBy(asc(reactions.id))
    .all();
  return REACTIONS.map((r) => {
    const given = rows.filter((row) => row.emoji === r.emoji);
    return {
      ...r,
      who: given.map((g) => g.name),
      mine: given.some((g) => g.personId === personId),
    };
  });
}

/** One reaction each: the same one again takes it back, another replaces it. */
export function react(target: Target, personId: number, emoji: string): void {
  const col = column(target.kind, reactions);
  const existing = db
    .select()
    .from(reactions)
    .where(and(eq(col, target.id), eq(reactions.personId, personId)))
    .get();
  if (existing?.emoji === emoji) {
    db.delete(reactions).where(eq(reactions.id, existing.id)).run();
  } else if (existing) {
    db.update(reactions).set({ emoji }).where(eq(reactions.id, existing.id)).run();
  } else {
    db.insert(reactions)
      .values({ ...targetValues(target), personId, emoji })
      .run();
  }
}

/** How many comments each of these hangouts has, for compact summaries. */
export function commentCounts(hangoutIds: number[]): Map<number, number> {
  if (hangoutIds.length === 0) return new Map();
  const rows = db
    .select({ id: comments.hangoutId, n: count() })
    .from(comments)
    .where(inArray(comments.hangoutId, hangoutIds))
    .groupBy(comments.hangoutId)
    .all();
  return new Map(rows.map((r) => [r.id ?? 0, r.n]));
}

/** "just now", "5m", "3h", "2d": when a comment was made, at a glance. */
export function ago(sqliteUtc: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(`${sqliteUtc.replace(" ", "T")}Z`)) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
