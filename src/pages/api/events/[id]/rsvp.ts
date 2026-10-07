import type { APIRoute } from "astro";
import { canSee, eventByShareId, respond } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import { notify } from "../../../../lib/notify";

const FLASH = { going: "going", maybe: "maybe", declined: "notGoing", waitlisted: "waitlisted" } as const;

/** Going (with any +1s), maybe, or can't go, by the rule in ADR 6: if the
 *  event is full, Going joins the waitlist, and leaving a spot moves the
 *  first person waiting into it. Anyone who can see the event can answer. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return new Response("No such event", { status: 404 });
  const me = currentPerson(cookies);
  if (!me) return redirect(`/e/${event.shareId}`, 303);
  if (!canSee(event, me)) return new Response("This event is private", { status: 403 });

  const form = await request.formData();
  const response = String(form.get("response") ?? "");
  if (response !== "going" && response !== "maybe" && response !== "declined") {
    return new Response("Answer going, maybe or declined", { status: 400 });
  }
  const { recorded, promoted } = respond(event, me.id, response, Number(form.get("plusOnes")) || 0);
  publish(`event:${event.shareId}`, "guests");
  // the people moved in from the waitlist are told wherever they are, and
  // in their inbox for when they're not (ADR 6)
  notify(promoted, {
    kind: "promoted",
    text: `A spot opened up: you're going to ${event.title}`,
    href: `/e/${event.shareId}`,
  });
  flash(cookies, FLASH[recorded as keyof typeof FLASH] ?? "going");
  return redirect(`/e/${event.shareId}`, 303);
};
