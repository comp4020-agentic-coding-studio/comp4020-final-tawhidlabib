import type { APIRoute } from "astro";
import { eventRef, logActivity, personLabel, refuse } from "../../../../lib/activity";
import { cancelEvent, eventByShareId, guestsOf } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import { notify } from "../../../../lib/notify";

/** The host calls it off. The event and its guest list go, and the guests
 *  are told (except those who'd already said they can't come). */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return refuse(cookies, "cancelled", eventRef(event), "not found", 404, "No such event");
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return refuse(cookies, "cancelled", eventRef(event), "not the host", 403, "Only the host can cancel");
  // the guest list goes with the event, so read it first
  const guests = guestsOf(event.id).filter((g) => g.person.id !== me.id);
  cancelEvent(event.id);
  logActivity({ who: personLabel(me), action: "cancelled", target: eventRef(event), outcome: "ok", detail: `${guests.length} guests` });
  publish(`event:${event.shareId}`, "cancelled");
  notify(
    guests.filter((g) => g.response !== "declined").map((g) => g.person.id),
    { kind: "invite", text: `${me.name} cancelled ${event.title}`, href: "/events", actorId: me.id },
  );
  // every guest's own events and calendar drop it, even if they said no
  for (const g of guests) publish(`person:${g.person.id}`, "events");
  flash(cookies, "cancelled");
  return redirect("/events", 303);
};
