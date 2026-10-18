import type { APIRoute } from "astro";
import { logActivity, refuse, whoIs } from "../../../../lib/activity";
import { getGroup, listMembers, proposeHangout } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { notify } from "../../../../lib/notify";
import { field } from "../../../../lib/forms";
import { currentMember } from "../../../../lib/identity";
import { isArchived } from "../../../../lib/manage";
import { HOURS, isDate, LAST_HOUR, spanLabel, weekStartOf } from "../../../../lib/time";

/** Propose a hangout: usually a recommended stretch, maybe shortened. Whoever
 *  proposes it is in. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "proposed hangout", `group ${params.id}`, "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me) return refuse(cookies, "proposed hangout", `group ${group.id}`, "not a member", 403, "Join the group first", group.id);
  if (isArchived(group)) return refuse(cookies, "proposed hangout", `group ${group.id}`, "group archived", 409, "This group is archived", group.id);

  const form = await request.formData();
  const date = String(form.get("date") ?? "");
  const start = Number(form.get("start"));
  const end = Number(form.get("end"));
  if (!isDate(date) || !HOURS.includes(start) || !(end > start && end <= LAST_HOUR + 1)) {
    return redirect(`/g/${group.id}?error=bad-time`, 303);
  }

  const title = field(form.get("title"), 80) || "Hangout";
  const { hangout, existed } = proposeHangout({ groupId: group.id, date, startHour: start, endHour: end, title, proposedBy: me.id });
  logActivity({ who: whoIs(cookies, group.id), action: existed ? "joined existing hangout" : "proposed hangout", target: `${hangout.id} in group ${group.id}`, outcome: "ok", detail: `${date} ${start}-${end}${existed ? ", merged with the same plan" : ""}` });
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
