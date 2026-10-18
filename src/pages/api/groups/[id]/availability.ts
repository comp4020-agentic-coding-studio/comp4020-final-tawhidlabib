import type { APIRoute } from "astro";
import { groupRef, logActivity, refuse, whoIs } from "../../../../lib/activity";
import { getGroup, setAvailability } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { currentMember } from "../../../../lib/identity";
import { isArchived } from "../../../../lib/manage";
import { announceEveryoneFree } from "../../../../lib/smarter";
import { markAnswered } from "../../../../lib/blind";
import { HOURS, isDate, weekDates, weekStartOf } from "../../../../lib/time";

/** Save which hours you're free across one week. The submitted boxes are the
 *  whole answer for that week: an hour left unticked is an hour not free. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "saved hours in", groupRef(params.id), "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me) return refuse(cookies, "saved hours in", groupRef(group), "not a member", 403, "Join the group first", group.id);
  if (isArchived(group)) return refuse(cookies, "saved hours in", groupRef(group), "group archived", 409, "This group is archived", group.id);

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
  logActivity({ who: whoIs(cookies, group.id), action: "saved hours in", target: groupRef(group), outcome: "ok", detail: `${free.length} hours, week of ${week}${form.has("quiet") ? ", autosave" : ""}${form.has("none") ? ", none work" : ""}` });
  // any save answers for the week --- hours, or "none of these work" (ADR 10)
  if (free.length > 0 || form.has("none")) markAnswered(me.id, week);
  publish(`group:${group.id}`, "availability");
  announceEveryoneFree(group, week);
  // the grid's autosave posts quietly: no toast on the next page load
  if (!form.has("quiet")) flash(cookies, "saved");
  return redirect(`/g/${group.id}?week=${week}#week`, 303);
};
