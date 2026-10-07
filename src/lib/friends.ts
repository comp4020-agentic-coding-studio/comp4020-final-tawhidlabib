import { and, eq, or } from "drizzle-orm";
import { eitherBlocked } from "./blocks";
import { db } from "./db";
import { peopleByIds, type Person } from "./people";
import { friendships } from "./schema";

// Friends: a request from one person to another, accepted by the second.
// Nobody can be found without their friend link, and a request is never a
// friendship until it's accepted.

export type Relationship = "self" | "friends" | "sent" | "received" | "none";

const between = (a: number, b: number) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export function relationship(me: number, other: number): Relationship {
  if (me === other) return "self";
  const row = db.select().from(friendships).where(between(me, other)).get();
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === me ? "sent" : "received";
}

/** Ask to be friends. If they'd already asked you, that's a yes from both,
 *  so you're friends straight away. */
export function requestFriend(from: number, to: number): Relationship {
  if (eitherBlocked(from, to)) return "none";
  const now = relationship(from, to);
  if (now === "received") {
    accept(from, to);
    return "friends";
  }
  if (now === "none") {
    db.insert(friendships).values({ requesterId: from, addresseeId: to, status: "pending" }).run();
    return "sent";
  }
  return now;
}

/** Accept the request `other` sent `me`. */
export function accept(me: number, other: number): void {
  db.update(friendships)
    .set({ status: "accepted" })
    .where(
      and(
        eq(friendships.requesterId, other),
        eq(friendships.addresseeId, me),
        eq(friendships.status, "pending"),
      ),
    )
    .run();
}

/** Decline a request, cancel your own, or unfriend: any tie between the two
 *  goes. */
export function removeTie(me: number, other: number): void {
  db.delete(friendships).where(between(me, other)).run();
}

function idsWhere(me: number, status: "pending" | "accepted", direction: "in" | "out" | "both") {
  const rows = db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, status),
        direction === "in"
          ? eq(friendships.addresseeId, me)
          : direction === "out"
            ? eq(friendships.requesterId, me)
            : or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)),
      ),
    )
    .all();
  return rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId));
}

const byName = (list: Person[]) => list.sort((a, b) => a.name.localeCompare(b.name));

export const friendsOf = (me: number) => byName(peopleByIds(idsWhere(me, "accepted", "both")));
export const incomingRequests = (me: number) => byName(peopleByIds(idsWhere(me, "pending", "in")));
export const outgoingRequests = (me: number) => byName(peopleByIds(idsWhere(me, "pending", "out")));
export const pendingCount = (me: number) => idsWhere(me, "pending", "in").length;
