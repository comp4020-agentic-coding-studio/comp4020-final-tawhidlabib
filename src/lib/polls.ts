import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { people, pollOptions, polls, pollVotes } from "./schema";
import type { Target } from "./talk";

// Polls on plans: a question, two to six options, single or multiple
// choice, closed by whoever asked. Who may ask and vote is the plan's
// thread rule (talk.ts openThread).

export type PollView = {
  id: number;
  question: string;
  multi: boolean;
  closed: boolean;
  createdBy: number;
  total: number;
  options: { id: number; label: string; voters: string[]; mine: boolean }[];
};

export const MAX_OPTIONS = 6;

const targetColumn = (t: Target) => (t.kind === "event" ? polls.eventId : polls.hangoutId);

export function createPoll(target: Target, by: number, question: string, labels: string[], multi: boolean) {
  db.transaction((tx) => {
    const poll = tx
      .insert(polls)
      .values({ ...(target.kind === "event" ? { eventId: target.id } : { hangoutId: target.id }), createdBy: by, question, multi })
      .returning()
      .get();
    tx.insert(pollOptions)
      .values(labels.map((label) => ({ pollId: poll.id, label })))
      .run();
  });
}

export function pollById(id: number) {
  return db.select().from(polls).where(eq(polls.id, id)).get();
}

export function pollsOn(target: Target, personId: number | undefined): PollView[] {
  const list = db.select().from(polls).where(eq(targetColumn(target), target.id)).orderBy(asc(polls.id)).all();
  if (list.length === 0) return [];
  const ids = list.map((p) => p.id);
  const options = db.select().from(pollOptions).where(inArray(pollOptions.pollId, ids)).orderBy(asc(pollOptions.id)).all();
  const votes = db
    .select({ optionId: pollVotes.optionId, pollId: pollVotes.pollId, personId: pollVotes.personId, name: people.name })
    .from(pollVotes)
    .innerJoin(people, eq(people.id, pollVotes.personId))
    .where(inArray(pollVotes.pollId, ids))
    .all();
  return list.map((p) => {
    const mine = votes.filter((v) => v.pollId === p.id);
    return {
      id: p.id,
      question: p.question,
      multi: p.multi,
      closed: p.closedAt !== null,
      createdBy: p.createdBy,
      total: new Set(mine.map((v) => v.personId)).size,
      options: options
        .filter((o) => o.pollId === p.id)
        .map((o) => {
          const on = mine.filter((v) => v.optionId === o.id);
          return { id: o.id, label: o.label, voters: on.map((v) => v.name), mine: on.some((v) => v.personId === personId) };
        }),
    };
  });
}

/** Vote for an option. Single choice: it replaces your vote (and the same
 *  again takes it back). Multiple choice: it toggles just that option. */
export function vote(pollId: number, optionId: number, personId: number, multi: boolean): void {
  db.transaction((tx) => {
    const option = tx
      .select()
      .from(pollOptions)
      .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)))
      .get();
    if (!option) return;
    const had = tx
      .select()
      .from(pollVotes)
      .where(and(eq(pollVotes.optionId, optionId), eq(pollVotes.personId, personId)))
      .get();
    if (!multi) {
      tx.delete(pollVotes).where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.personId, personId))).run();
    } else if (had) {
      tx.delete(pollVotes).where(and(eq(pollVotes.optionId, optionId), eq(pollVotes.personId, personId))).run();
    }
    if (!had) tx.insert(pollVotes).values({ optionId, pollId, personId }).run();
  });
}

export function closePoll(pollId: number): void {
  db.update(polls).set({ closedAt: new Date().toISOString() }).where(eq(polls.id, pollId)).run();
}

/** The plan a poll belongs to, as talk.ts names it. */
export function pollTarget(poll: { eventId: number | null; hangoutId: number | null }): Target {
  return poll.eventId !== null ? { kind: "event", id: poll.eventId } : { kind: "hangout", id: poll.hangoutId ?? 0 };
}
