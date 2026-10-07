import type { APIRoute } from "astro";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { currentMember } from "../../../../lib/identity";
import { memberById } from "../../../../lib/manage";
import { notify } from "../../../../lib/notify";
import { nudgeOnce } from "../../../../lib/smarter";
import { dayLabel, isDate, weekStartOf } from "../../../../lib/time";

/** Nudge someone in your group to mark their hours: once a week each, so
 *  it's a reminder, not a nag. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me?.personId) return new Response("Join the group with a profile first", { status: 403 });

  const form = await request.formData();
  const week = String(form.get("week") ?? "");
  const them = memberById(group.id, Number(form.get("member")));
  if (!them?.personId || them.id === me.id || !isDate(week) || weekStartOf(week) !== week) {
    return redirect(`/g/${group.id}#people`, 303);
  }
  if (nudgeOnce(group.id, me.personId, them.id, week)) {
    notify([them.personId], {
      kind: "nudge",
      text: `${me.name} nudged you to mark your hours in ${group.name} for the week of ${dayLabel(week)}`,
      href: `/g/${group.id}?week=${week}#week`,
      actorId: me.personId,
    });
  }
  flash(cookies, "nudged");
  return redirect(`/g/${group.id}?week=${week}#people`, 303);
};
