import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse } from "../../../../lib/activity";
import { cancelEvent, eventByShareId } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";

/** The host calls it off. The event and its guest list go. */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return refuse(cookies, "cancelled event", `event ${params.id}`, "not found", 404, "No such event");
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return refuse(cookies, "cancelled event", `event ${event.shareId}`, "not the host", 403, "Only the host can cancel");
  cancelEvent(event.id);
  logActivity({ who: personLabel(me), action: "cancelled event", target: `event ${event.shareId}`, outcome: "ok" });
  publish(`event:${event.shareId}`, "cancelled");
  flash(cookies, "cancelled");
  return redirect("/events", 303);
};
