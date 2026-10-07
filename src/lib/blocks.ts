import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "./db";
import { removeTie } from "./friends";
import { blocks, members } from "./schema";

// Having less of someone. Blocking a person ends any friendship and keeps
// their requests, invites and notifications from reaching you, and hides
// their comments from you; they aren't told. Muting a group keeps its
// notifications out of your inbox.

export function block(blockerId: number, blockedId: number): void {
  if (blockerId === blockedId) return;
  db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing().run();
  removeTie(blockerId, blockedId);
}

export function unblock(blockerId: number, blockedId: number): void {
  db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))).run();
}

/** Whether either of two people has blocked the other. */
export function eitherBlocked(a: number, b: number): boolean {
  return !!db
    .select()
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .get();
}

export const hasBlocked = (blockerId: number, blockedId: number) =>
  !!db
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
    .get();

/** Everyone this person has blocked. */
export function blockedBy(blockerId: number): Set<number> {
  return new Set(
    db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, blockerId)).all().map((r) => r.id),
  );
}

/** Of these people, who has blocked the actor (and so shouldn't hear from
 *  them). */
export function whoBlocked(actorId: number, among: number[]): Set<number> {
  if (among.length === 0) return new Set();
  return new Set(
    db
      .select({ id: blocks.blockerId })
      .from(blocks)
      .where(and(eq(blocks.blockedId, actorId), inArray(blocks.blockerId, among)))
      .all()
      .map((r) => r.id),
  );
}

/** Of these people, who has muted the group. */
export function whoMuted(groupId: string, among: number[]): Set<number> {
  if (among.length === 0) return new Set();
  return new Set(
    db
      .select({ id: members.personId })
      .from(members)
      .where(and(eq(members.groupId, groupId), eq(members.muted, true), inArray(members.personId, among)))
      .all()
      .map((r) => r.id ?? 0),
  );
}

export function setMuted(memberId: number, muted: boolean): void {
  db.update(members).set({ muted }).where(eq(members.id, memberId)).run();
}
