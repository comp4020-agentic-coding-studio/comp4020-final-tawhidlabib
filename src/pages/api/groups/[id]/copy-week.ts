import type { APIRoute } from "astro";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { currentMember } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import { isArchived } from "../../../../lib/manage";
import { announceEveryoneFree, copyLastWeek } from "../../../../lib/smarter";
import { isDate, weekStartOf } from "../../../../lib/time";

/** Lay last week's hours onto this week, in one tap. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me) return new Response("Join the group first", { status: 403 });
  if (isArchived(group)) return new Response("This group is archived", { status: 409 });

  const week = String((await request.formData()).get("week") ?? "");
  if (!isDate(week) || weekStartOf(week) !== week) return new Response("Not a week", { status: 400 });
  const copied = copyLastWeek(me.id, week);
  if (copied > 0) {
    publish(`group:${group.id}`, "availability");
    announceEveryoneFree(group, week);
  }
  flash(cookies, copied > 0 ? "copied" : "nothingToCopy");
  return redirect(`/g/${group.id}?week=${week}#week`, 303);
};
