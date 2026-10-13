import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { availability, weekAnswers } from "./schema";
import { weekDates } from "./time";

// The blind grid (ADR 10). In open scheduling polls people answer
// strategically --- they approve slots that look popular, to seem
// cooperative, and avoid the uncertain middle (Zou, Meir & Parkes, CSCW
// 2015) --- so the group's hours for a week are hidden from you until you've
// given your own honest answer for it. Answering is marking hours, or saying
// none of these work.

export function markAnswered(memberId: number, week: string): void {
  db.insert(weekAnswers).values({ memberId, week }).onConflictDoNothing().run();
}

/** Whether a member has answered for a week: recorded, or (for weeks
 *  marked before the blind grid existed) any hours they marked in it. */
export function hasAnswered(memberId: number, week: string): boolean {
  if (db.select().from(weekAnswers).where(and(eq(weekAnswers.memberId, memberId), eq(weekAnswers.week, week))).get()) {
    return true;
  }
  return !!db
    .select({ hour: availability.hour })
    .from(availability)
    .where(and(eq(availability.memberId, memberId), inArray(availability.date, weekDates(week))))
    .get();
}

/** Of these members, who has answered for the week. */
export function answeredAmong(memberIds: number[], week: string): Set<number> {
  return new Set(memberIds.filter((id) => hasAnswered(id, week)));
}
