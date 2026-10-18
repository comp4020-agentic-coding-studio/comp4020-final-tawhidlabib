import type { APIRoute } from "astro";
import { groupRef, logActivity, refuse, whoIs } from "../../../../lib/activity";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { currentMember } from "../../../../lib/identity";
import { memberById } from "../../../../lib/manage";
import { notify } from "../../../../lib/notify";
import { nudgeOnce } from "../../../../lib/smarter";
import { isArchived } from "../../../../lib/manage";
import { addDays, currentWeekStart, dayLabel, isDate, weekStartOf } from "../../../../lib/time";

/** Nudge someone in your group to mark their hours: once a week each, so
 *  it's a reminder, not a nag. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "nudged", groupRef(params.id), "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me?.personId) return refuse(cookies, "nudged", groupRef(group), "not a member with a profile", 403, "Join the group with a profile first", group.id);

  if (isArchived(group)) return refuse(cookies, "nudged", groupRef(group), "group archived", 409, "This group is archived", group.id);

  const form = await request.formData();
  const week = String(form.get("week") ?? "");
  const them = memberById(group.id, Number(form.get("member")));
  // a real Monday, within ten years of this week: a nudge is for plans in reach
  const thisWeek = currentWeekStart(group.timezone);
  const near = isDate(week) && week >= addDays(thisWeek, -7 * 520) && week <= addDays(thisWeek, 7 * 520);
  if (!them?.personId || them.id === me.id || !near || weekStartOf(week) !== week) {
    return redirect(`/g/${group.id}#people`, 303);
  }
  const sent = nudgeOnce(group.id, me.personId, them.id, week);
  logActivity({ who: whoIs(cookies, group.id), action: "nudged", target: `m${them.id} "${them.name}" in ${groupRef(group)}`, outcome: "ok", detail: sent ? `week of ${week}` : "already nudged this week" });
  if (sent) {
    notify([them.personId], {
      kind: "nudge",
      text: `${me.name} nudged you to mark your hours in ${group.name} for the week of ${dayLabel(week)}`,
      href: `/g/${group.id}?week=${week}#week`,
      actorId: me.personId,
      groupId: group.id,
    });
  }
  flash(cookies, "nudged");
  return redirect(`/g/${group.id}?week=${week}#people`, 303);
};
