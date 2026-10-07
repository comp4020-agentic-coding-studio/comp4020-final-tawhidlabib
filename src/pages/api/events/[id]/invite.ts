import type { APIRoute } from "astro";
import { allowedInvitees, groupInvitees } from "../../../../lib/circle";
import { eventByShareId, invite } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";

/** The host invites more people: friends, or a whole group. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return new Response("No such event", { status: 404 });
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return new Response("Only the host can invite", { status: 403 });

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
  publish(`event:${event.shareId}`, "guests");
  for (const id of invited) publish(`person:${id}`, "invited");
  flash(cookies, "invited");
  return redirect(`/e/${event.shareId}`, 303);
};
