import { and, eq, inArray } from "drizzle-orm";
import { db, type Group, listMembers, setAvailability } from "./db";
import { notify } from "./notify";
import { freeMap } from "./overview";
import { recommend } from "./recommend";
import { availability, everyoneFree, nudges } from "./schema";
import { addDays, hasStarted, spanLabel, weekDates } from "./time";

// Smarter availability: copying last week, nudging, and telling a group
// when every one of them is free at once.

/** Your hours from the week before `week`, laid onto `week`. Returns how
 *  many hours were copied (none means there was nothing to copy). */
export function copyLastWeek(memberId: number, week: string): number {
  const last = weekDates(addDays(week, -7));
  const hours = db
    .select({ date: availability.date, hour: availability.hour })
    .from(availability)
    .where(and(eq(availability.memberId, memberId), inArray(availability.date, last)))
    .all();
  if (hours.length > 0) {
    setAvailability(
      memberId,
      weekDates(week),
      hours.map((h) => ({ date: addDays(h.date, 7), hour: h.hour })),
    );
  }
  return hours.length;
}

/** Record a nudge; false if this person already nudged them this week. */
export function nudgeOnce(groupId: string, fromPersonId: number, toMemberId: number, week: string): boolean {
  const done = db.insert(nudges).values({ groupId, fromPersonId, toMemberId, week }).onConflictDoNothing().run();
  return done.changes > 0;
}

/** After hours change: any stretch this week that every member (two or
 *  more) now shares, and hasn't been announced, is announced to them all. */
export function announceEveryoneFree(group: Group, week: string): void {
  const members = listMembers(group.id);
  if (members.length < 2) return;
  const dates = weekDates(week);
  const shared = recommend(members.length, freeMap(group.id, dates), dates, (d, h) =>
    hasStarted(d, h, group.timezone),
  ).filter((r) => r.people.length === members.length);
  for (const r of shared) {
    const fresh = db
      .insert(everyoneFree)
      .values({ groupId: group.id, date: r.date, startHour: r.start, endHour: r.end })
      .onConflictDoNothing()
      .run();
    if (fresh.changes === 0) continue;
    notify(
      members.map((m) => m.personId).filter((id): id is number => id !== null),
      {
        kind: "everyone",
        text: `Everyone's free ${spanLabel(r.date, r.start, r.end)} in ${group.name}. Propose it?`,
        href: `/g/${group.id}?week=${week}#best`,
        groupId: group.id,
      },
    );
  }
}
