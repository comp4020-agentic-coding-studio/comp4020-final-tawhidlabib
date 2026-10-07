import type { APIRoute } from "astro";
import { getGroup, setAvailability } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { currentMember } from "../../../../lib/identity";
import { isArchived } from "../../../../lib/manage";
import { announceEveryoneFree } from "../../../../lib/smarter";
import { HOURS, isDate, weekDates, weekStartOf } from "../../../../lib/time";

/** Save which hours you're free across one week. The submitted boxes are the
 *  whole answer for that week: an hour left unticked is an hour not free. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me) return new Response("Join the group first", { status: 403 });
  if (isArchived(group)) return new Response("This group is archived", { status: 409 });

  const form = await request.formData();
  const week = String(form.get("week") ?? "");
  if (!isDate(week) || weekStartOf(week) !== week) {
    return new Response("Not a week", { status: 400 });
  }
  const dates = weekDates(week);

  const free: { date: string; hour: number }[] = [];
  for (const value of form.getAll("slot")) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/.exec(String(value));
    if (!match) continue;
    const [, date, hour] = match;
    if (dates.includes(date) && HOURS.includes(Number(hour))) {
      free.push({ date, hour: Number(hour) });
    }
  }

  setAvailability(me.id, dates, free);
  publish(`group:${group.id}`, "availability");
  announceEveryoneFree(group, week);
  // the grid's autosave posts quietly: no toast on the next page load
  if (!form.has("quiet")) flash(cookies, "saved");
  return redirect(`/g/${group.id}?week=${week}#week`, 303);
};
