import { availabilityOn, type Group, type Hangout, listMembers, type Member, upcomingHangouts } from "./db";
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

/** A group at a glance, for /groups: its members, its next hangout, and the
 *  best time this week so far. */
export function groupOverview(group: Group): {
  members: Member[];
  next: Hangout | undefined;
  best: Recommendation | undefined;
} {
  const members = listMembers(group.id);
  const dates = weekDates(currentWeekStart(group.timezone));
  const best = recommend(members.length, freeMap(group.id, dates), dates, (date, hour) =>
    hasStarted(date, hour, group.timezone),
  )[0];
  return { members, next: upcomingHangouts(group.id, todayIn(group.timezone))[0], best };
}
