import type { APIRoute } from "astro";
import { eventRef, logActivity, personLabel, refuse } from "../../../../lib/activity";
import { readEventForm } from "../../../../lib/eventForm";
import { eventByShareId, guestsOf, refill, updateEvent } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import { notify } from "../../../../lib/notify";

/** The host changes their event. A higher spot limit moves people in from
 *  the waitlist (ADR 6), and guests are told what changed. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return refuse(cookies, "edited", eventRef(event), "not found", 404, "No such event");
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return refuse(cookies, "edited", eventRef(event), "not the host", 403, "Only the host can edit");

  const read = readEventForm(await request.formData());
  if ("error" in read) return redirect(`/e/${event.shareId}/edit?error=${read.error}`, 303);
  const updated = updateEvent(event.id, read.fields);
  const promoted = refill(updated);
  logActivity({ who: personLabel(me), action: "edited", target: eventRef(event), outcome: "ok", detail: promoted.length ? `${promoted.length} moved off the waitlist` : undefined });

  const href = `/e/${event.shareId}`;
  notify(promoted, { kind: "promoted", text: `A spot opened up: you're going to ${updated.title}`, href });
  const guests = guestsOf(event.id)
    .filter((g) => g.response === "going" || g.response === "maybe")
    .map((g) => g.person.id)
    .filter((id) => !promoted.includes(id));
  notify(guests, { kind: "invite", text: `${me.name} updated ${updated.title}`, href, actorId: me.id });
  publish(`event:${event.shareId}`, "edited");
  flash(cookies, "edited");
  return redirect(href, 303);
};
