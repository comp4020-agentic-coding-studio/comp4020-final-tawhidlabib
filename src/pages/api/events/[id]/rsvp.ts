import type { APIRoute } from "astro";
import { canSee, eventByShareId, respond } from "../../../../lib/events";
import { flash } from "../../../../lib/flash";
import { currentPerson } from "../../../../lib/identity";

const FLASH = { going: "going", maybe: "maybe", declined: "notGoing" } as const;

/** Going, maybe, or can't go. Anyone who can see the event can answer: for a
 *  public one that's anyone with a profile, for a private one its guests. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return new Response("No such event", { status: 404 });
  const me = currentPerson(cookies);
  if (!me) return redirect(`/e/${event.shareId}`, 303);
  if (!canSee(event, me)) return new Response("This event is private", { status: 403 });

  const response = String((await request.formData()).get("response") ?? "");
  if (response !== "going" && response !== "maybe" && response !== "declined") {
    return new Response("Answer going, maybe or declined", { status: 400 });
  }
  respond(event.id, me.id, response);
  flash(cookies, FLASH[response]);
  return redirect(`/e/${event.shareId}`, 303);
};
