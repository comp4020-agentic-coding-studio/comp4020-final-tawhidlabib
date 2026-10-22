import type { APIRoute } from "astro";
import { groupRef, logActivity, refuse, whoIs } from "../../../../lib/activity";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { currentMember } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import { isArchived } from "../../../../lib/manage";
import { announceEveryoneFree, copyLastWeek } from "../../../../lib/smarter";
import { isWeekInReach } from "../../../../lib/time";

/** Lay last week's hours onto this week, in one tap. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "copied last week into", groupRef(params.id), "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me) return refuse(cookies, "copied last week into", groupRef(group), "not a member", 403, "Join the group first", group.id);
  if (isArchived(group)) return refuse(cookies, "copied last week into", groupRef(group), "group archived", 409, "This group is archived", group.id);

  const week = String((await request.formData()).get("week") ?? "");
  if (!isWeekInReach(week, group.timezone)) return new Response("Not a week", { status: 400 });
  const copied = copyLastWeek(me.id, week);
  logActivity({ who: whoIs(cookies, group.id), action: "copied last week into", target: groupRef(group), outcome: "ok", detail: `${copied} hours, week of ${week}` });
  if (copied > 0) {
    publish(`group:${group.id}`, "availability");
    announceEveryoneFree(group, week);
  }
  flash(cookies, copied > 0 ? "copied" : "nothingToCopy");
  return redirect(`/g/${group.id}?week=${week}#week`, 303);
};
