import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { publish } from "./live";
import { type Notification, notifications, people } from "./schema";

// The inbox. Anything a person should hear about is written here and pushed
// on their live topic, so the bell updates wherever they are on the site.
// Whoever caused it is never told about their own action.

export type { Notification };
export type Note = Notification & { actorName: string | null };

export function notify(
  personIds: Iterable<number>,
  note: { kind: string; text: string; href: string; actorId?: number | null },
): void {
  const to = [...new Set(personIds)].filter((id) => id !== note.actorId);
  if (to.length === 0) return;
  db.insert(notifications)
    .values(to.map((personId) => ({ personId, ...note, actorId: note.actorId ?? null })))
    .run();
  for (const id of to) publish(`person:${id}`, "inbox");
}

export function inboxOf(personId: number, limit = 60): Note[] {
  return db
    .select({ note: notifications, actorName: people.name })
    .from(notifications)
    .leftJoin(people, eq(people.id, notifications.actorId))
    .where(eq(notifications.personId, personId))
    .orderBy(desc(notifications.id))
    .limit(limit)
    .all()
    .map((r) => ({ ...r.note, actorName: r.actorName }));
}

export function unreadCount(personId: number): number {
  return (
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.personId, personId), isNull(notifications.readAt)))
      .get()?.n ?? 0
  );
}

/** Open one of your notifications: mark it read and say where it goes.
 *  Undefined if it isn't yours. */
export function openNote(personId: number, id: number): string | undefined {
  const note = db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.personId, personId)))
    .get();
  if (!note) return undefined;
  db.update(notifications).set({ readAt: new Date().toISOString() }).where(eq(notifications.id, id)).run();
  return note.href;
}

export function readAll(personId: number): void {
  db.update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.personId, personId), isNull(notifications.readAt)))
    .run();
}

/** "“I'll bring salsa…”": a comment cut short for a notification. */
export const snippet = (text: string, max = 60) =>
  `“${text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text}”`;
