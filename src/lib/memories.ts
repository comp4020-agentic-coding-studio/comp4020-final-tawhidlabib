import { and, asc, avg, count, eq } from "drizzle-orm";
import { db } from "./db";
import { people, photos, ratings } from "./schema";
import type { Target } from "./talk";

// After the hangout: a shared album and "how was it?" on each plan.

export const SCORES = [
  { score: 1, emoji: "😞", name: "Not great" },
  { score: 2, emoji: "😐", name: "Okay" },
  { score: 3, emoji: "🙂", name: "Good" },
  { score: 4, emoji: "😄", name: "Great" },
  { score: 5, emoji: "🤩", name: "Amazing" },
] as const;

const on = (t: Target, table: typeof photos | typeof ratings) =>
  t.kind === "event" ? eq(table.eventId, t.id) : eq(table.hangoutId, t.id);
const of = (t: Target) => (t.kind === "event" ? { eventId: t.id } : { hangoutId: t.id });

export function photosOn(target: Target) {
  return db
    .select({ id: photos.id, file: photos.file, uploaderId: photos.uploaderId, by: people.name })
    .from(photos)
    .innerJoin(people, eq(people.id, photos.uploaderId))
    .where(on(target, photos))
    .orderBy(asc(photos.id))
    .all();
}

export function addPhoto(target: Target, uploaderId: number, file: string, mime: string): void {
  db.insert(photos)
    .values({ ...of(target), uploaderId, file, mime })
    .run();
}

export const photoById = (id: number) => db.select().from(photos).where(eq(photos.id, id)).get();
export const photoByFile = (file: string) => db.select().from(photos).where(eq(photos.file, file)).get();
export const deletePhoto = (id: number) => db.delete(photos).where(eq(photos.id, id)).run();

export function photoTarget(p: { eventId: number | null; hangoutId: number | null }): Target {
  return p.eventId !== null ? { kind: "event", id: p.eventId } : { kind: "hangout", id: p.hangoutId ?? 0 };
}

export function ratingOn(target: Target, personId: number | undefined) {
  const summary = db
    .select({ average: avg(ratings.score), n: count() })
    .from(ratings)
    .where(on(target, ratings))
    .get();
  const mine = personId
    ? db
        .select({ score: ratings.score })
        .from(ratings)
        .where(and(on(target, ratings), eq(ratings.personId, personId)))
        .get()?.score
    : undefined;
  return { average: summary?.average ? Number(summary.average) : null, count: summary?.n ?? 0, mine };
}

/** One rating each: the same again takes it back, another replaces it. */
export function rate(target: Target, personId: number, score: number): void {
  const existing = db
    .select()
    .from(ratings)
    .where(and(on(target, ratings), eq(ratings.personId, personId)))
    .get();
  if (existing?.score === score) db.delete(ratings).where(eq(ratings.id, existing.id)).run();
  else if (existing) db.update(ratings).set({ score }).where(eq(ratings.id, existing.id)).run();
  else db.insert(ratings).values({ ...of(target), personId, score }).run();
}
