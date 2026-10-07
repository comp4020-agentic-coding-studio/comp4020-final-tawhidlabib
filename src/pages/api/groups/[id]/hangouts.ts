import type { APIRoute } from "astro";
import { getGroup, proposeHangout } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { field } from "../../../../lib/forms";
import { currentMember } from "../../../../lib/identity";
import { HOURS, isDate, LAST_HOUR, weekStartOf } from "../../../../lib/time";

/** Propose a hangout: usually a recommended stretch, maybe shortened. Whoever
 *  proposes it is in. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me) return new Response("Join the group first", { status: 403 });

  const form = await request.formData();
  const date = String(form.get("date") ?? "");
  const start = Number(form.get("start"));
  const end = Number(form.get("end"));
  if (!isDate(date) || !HOURS.includes(start) || !(end > start && end <= LAST_HOUR + 1)) {
    return redirect(`/g/${group.id}?error=bad-time`, 303);
  }

  proposeHangout({
    groupId: group.id,
    date,
    startHour: start,
    endHour: end,
    title: field(form.get("title"), 80) || "Hangout",
    proposedBy: me.id,
  });
  flash(cookies, "proposed");
  return redirect(`/g/${group.id}?week=${weekStartOf(date)}#plans`, 303);
};
