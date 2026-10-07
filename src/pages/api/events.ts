import type { APIRoute } from "astro";
import { allowedInvitees, groupInvitees } from "../../lib/circle";
import { createEvent } from "../../lib/events";
import { flash } from "../../lib/flash";
import { readEventForm } from "../../lib/eventForm";
import { notify } from "../../lib/notify";
import { currentPerson } from "../../lib/identity";

/** Host an event: public (anyone with the link, listed on Explore) or
 *  private (only the people invited). Invites go to friends and to whole
 *  groups you're in, and nobody else. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/events/new", 303);

  const form = await request.formData();
  const read = readEventForm(form);
  if ("error" in read) return redirect(`/events/new?error=${read.error}`, 303);
  const title = read.fields.title;

  const cookie = request.headers.get("cookie");
  const allowed = allowedInvitees(me, cookie);
  const invites = [
    ...form
      .getAll("invite")
      .map(Number)
      .filter((id) => allowed.has(id)),
    ...groupInvitees(me, cookie, form.getAll("inviteGroup").map(String)),
  ];

  const event = createEvent({ ...read.fields, timezone: me.timezone }, me.id, invites);
  notify(invites, {
    kind: "invite",
    text: `${me.name} invited you to ${title}`,
    href: `/e/${event.shareId}`,
    actorId: me.id,
  });
  flash(cookies, "hosted");
  return redirect(`/e/${event.shareId}`, 303);
};
