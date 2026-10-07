import type { APIRoute } from "astro";
import { cancelEvent, eventByShareId } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";

/** The host calls it off. The event and its guest list go. */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return new Response("No such event", { status: 404 });
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return new Response("Only the host can cancel", { status: 403 });
  cancelEvent(event.id);
  publish(`event:${event.shareId}`, "cancelled");
  flash(cookies, "cancelled");
  return redirect("/events", 303);
};
