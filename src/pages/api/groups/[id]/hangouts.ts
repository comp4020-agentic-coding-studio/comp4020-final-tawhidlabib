import type { APIRoute } from "astro";
import { groupRef, logActivity, refuse, whoIs } from "../../../../lib/activity";
import { getGroup, listMembers, proposeHangout } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { notify } from "../../../../lib/notify";
import { field } from "../../../../lib/forms";
import { currentMember } from "../../../../lib/identity";
import { isArchived } from "../../../../lib/manage";
import { HOURS, isDate, LAST_HOUR, spanLabel, todayIn, weekStartOf } from "../../../../lib/time";

/** Propose a hangout: usually a recommended stretch, maybe shortened. Whoever
 *  proposes it is in. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "proposed a hangout in", groupRef(params.id), "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me) return refuse(cookies, "proposed a hangout in", groupRef(group), "not a member", 403, "Join the group first", group.id);
  if (isArchived(group)) return refuse(cookies, "proposed a hangout in", groupRef(group), "group archived", 409, "This group is archived", group.id);

  const form = await request.formData();
  const date = String(form.get("date") ?? "");
  const start = Number(form.get("start"));
  const end = Number(form.get("end"));
  if (!isDate(date) || !HOURS.includes(start) || !(end > start && end <= LAST_HOUR + 1)) {
    return redirect(`/g/${group.id}?error=bad-time`, 303);
  }
  // a plan is for a day that hasn't gone: today, in the group's timezone, still counts
  if (date < todayIn(group.timezone)) {
    return refuse(cookies, "proposed a hangout in", groupRef(group), "date in the past", 400, "That date is in the past. Pick today or later.", group.id);
  }

  const title = field(form.get("title"), 80) || "Hangout";
  const { hangout, existed } = proposeHangout({ groupId: group.id, date, startHour: start, endHour: end, title, proposedBy: me.id });
  logActivity({ who: whoIs(cookies, group.id), action: existed ? "proposed (the same time, so joined)" : "proposed", target: `hangout ${hangout.id} in ${groupRef(group)}`, outcome: "ok", detail: `${date} ${start}-${end}` });
  publish(`group:${group.id}`, "plans");
  // proposing a plan that already exists is saying you're in it
  if (existed) {
    flash(cookies, "in");
    return redirect(`/g/${group.id}?week=${weekStartOf(date)}#plans`, 303);
  }
  notify(
    listMembers(group.id)
      .map((m) => m.personId)
      .filter((id): id is number => id !== null),
    {
      kind: "proposed",
      text: `${me.name} proposed ${title} in ${group.name}, ${spanLabel(date, start, end)}`,
      href: `/g/${group.id}?week=${weekStartOf(date)}#plans`,
      actorId: me.personId,
      groupId: group.id,
    },
  );
  flash(cookies, "proposed");
  return redirect(`/g/${group.id}?week=${weekStartOf(date)}#plans`, 303);
};
