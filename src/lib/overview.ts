import { availabilityOn, type Group, type Hangout, listMembers, type Member, upcomingHangouts } from "./db";
import { hasAnswered } from "./blind";
import { type Recommendation, recommend } from "./recommend";
import { currentWeekStart, hasStarted, slotKey, todayIn, weekDates } from "./time";

/** Who's free in each hour of a week, by slot key. */
export function freeMap(groupId: string, dates: string[]): Map<string, Set<number>> {
  const free = new Map<string, Set<number>>();
  for (const a of availabilityOn(groupId, dates)) {
    const key = slotKey(a.date, a.hour);
    if (!free.has(key)) free.set(key, new Set());
    free.get(key)?.add(a.memberId);
  }
  return free;
}

/** A group at a glance, for /groups and home: its members, its next
 *  hangout, and the best time this week so far --- which, by the blind grid
 *  (ADR 10), only someone who has answered for this week may see. */
export function groupOverview(group: Group, viewer?: Member): {
  members: Member[];
  next: Hangout | undefined;
  best: Recommendation | undefined;
} {
  const members = listMembers(group.id);
  const week = currentWeekStart(group.timezone);
  const dates = weekDates(week);
  const answered = !!viewer && hasAnswered(viewer.id, week);
  const best = !answered ? undefined : recommend(members.length, freeMap(group.id, dates), dates, (date, hour) =>
    hasStarted(date, hour, group.timezone),
  )[0];
  return { members, next: upcomingHangouts(group.id, todayIn(group.timezone))[0], best };
}
