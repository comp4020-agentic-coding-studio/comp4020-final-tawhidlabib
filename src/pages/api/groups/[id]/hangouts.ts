import type { APIRoute } from "astro";
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
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me) return new Response("Join the group first", { status: 403 });
  if (isArchived(group)) return new Response("This group is archived", { status: 409 });

  const form = await request.formData();
  const date = String(form.get("date") ?? "");
  const start = Number(form.get("start"));
  const end = Number(form.get("end"));
  if (!isDate(date) || !HOURS.includes(start) || !(end > start && end <= LAST_HOUR + 1)) {
    return redirect(`/g/${group.id}?error=bad-time`, 303);
  }

  const title = field(form.get("title"), 80) || "Hangout";
  proposeHangout({ groupId: group.id, date, startHour: start, endHour: end, title, proposedBy: me.id });
  publish(`group:${group.id}`, "plans");
  notify(
    listMembers(group.id)
      .map((m) => m.personId)
      .filter((id): id is number => id !== null),
    {
      kind: "proposed",
      text: `${me.name} proposed ${title} in ${group.name}, ${spanLabel(date, start, end)}`,
      href: `/g/${group.id}?week=${weekStartOf(date)}#plans`,
      actorId: me.personId,
    },
  );
  flash(cookies, "proposed");
  return redirect(`/g/${group.id}?week=${weekStartOf(date)}#plans`, 303);
};
