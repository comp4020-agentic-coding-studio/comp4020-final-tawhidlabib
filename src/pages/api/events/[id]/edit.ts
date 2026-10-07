import type { APIRoute } from "astro";
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
  if (!event) return new Response("No such event", { status: 404 });
  const me = currentPerson(cookies);
  if (!me || me.id !== event.hostId) return new Response("Only the host can edit", { status: 403 });

  const read = readEventForm(await request.formData());
  if ("error" in read) return redirect(`/e/${event.shareId}/edit?error=${read.error}`, 303);
  const updated = updateEvent(event.id, read.fields);
  const promoted = refill(updated);

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
