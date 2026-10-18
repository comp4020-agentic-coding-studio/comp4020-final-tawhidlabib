import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse } from "../../../../lib/activity";
import { allowedInvitees, groupInvitees } from "../../../../lib/circle";
import { eventByShareId, invite } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import { notify } from "../../../../lib/notify";

/** The host invites more people: friends, or a whole group. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return refuse(cookies, "invited to event", `event ${params.id}`, "not found", 404, "No such event");
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return refuse(cookies, "invited to event", `event ${event.shareId}`, "not the host", 403, "Only the host can invite");

  const form = await request.formData();
  const cookie = request.headers.get("cookie");
  const allowed = allowedInvitees(me, cookie);
  const invited = [
    ...form
      .getAll("invite")
      .map(Number)
      .filter((id) => allowed.has(id)),
    ...groupInvitees(me, cookie, form.getAll("inviteGroup").map(String)),
  ];
  invite(event.id, me.id, invited);
  logActivity({ who: personLabel(me), action: "invited to event", target: `event ${event.shareId}`, outcome: "ok", detail: `${invited.length} people` });
  publish(`event:${event.shareId}`, "guests");
  notify(invited, {
    kind: "invite",
    text: `${me.name} invited you to ${event.title}`,
    href: `/e/${event.shareId}`,
    actorId: me.id,
  });
  flash(cookies, "invited");
  return redirect(`/e/${event.shareId}`, 303);
};
