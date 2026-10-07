import type { APIRoute } from "astro";
import { eventEvent, ics } from "../../../lib/calendar";
import { canSee, eventByShareId } from "../../../lib/events";
import { currentPerson } from "../../../lib/identity";

/** The event as a calendar file, for anyone who may see it. */
export const GET: APIRoute = ({ params, cookies, url }) => {
  const event = eventByShareId(params.id ?? "");
  if (!event) return new Response("No such event", { status: 404 });
  if (!canSee(event, currentPerson(cookies))) {
    return new Response("This event is private", { status: 403 });
  }
  return new Response(ics(eventEvent(event, url.origin)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="event-${event.shareId}.ics"`,
    },
  });
};
