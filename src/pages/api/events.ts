import type { APIRoute } from "astro";
import { allowedInvitees, groupInvitees } from "../../lib/circle";
import { createEvent } from "../../lib/events";
import { flash } from "../../lib/flash";
import { field } from "../../lib/forms";
import { currentPerson } from "../../lib/identity";
import { isClock, isDate } from "../../lib/time";

/** Host an event: public (anyone with the link, listed on Explore) or
 *  private (only the people invited). Invites go to friends and to whole
 *  groups you're in, and nobody else. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/events/new", 303);

  const form = await request.formData();
  const title = field(form.get("title"), 80);
  const date = String(form.get("date") ?? "");
  const startTime = String(form.get("start") ?? "");
  const endTime = String(form.get("end") ?? "");
  if (!title || !isDate(date) || !isClock(startTime) || !isClock(endTime)) {
    return redirect("/events/new?error=event-missing", 303);
  }
  if (endTime <= startTime) return redirect("/events/new?error=event-time", 303);

  const cookie = request.headers.get("cookie");
  const allowed = allowedInvitees(me, cookie);
  const invites = [
    ...form
      .getAll("invite")
      .map(Number)
      .filter((id) => allowed.has(id)),
    ...groupInvitees(me, cookie, form.getAll("inviteGroup").map(String)),
  ];

  const event = createEvent(
    {
      title,
      date,
      startTime,
      endTime,
      location: field(form.get("location"), 120),
      details: String(form.get("details") ?? "").trim().slice(0, 1000),
      timezone: me.timezone,
      visibility: form.get("visibility") === "private" ? "private" : "public",
    },
    me.id,
    invites,
  );
  flash(cookies, "hosted");
  return redirect(`/e/${event.shareId}`, 303);
};
