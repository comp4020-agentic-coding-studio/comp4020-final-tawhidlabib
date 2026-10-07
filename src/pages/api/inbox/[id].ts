import type { APIRoute } from "astro";
import { currentPerson } from "../../../lib/identity";
import { publish } from "../../../lib/live";
import { openNote } from "../../../lib/notify";

/** Open a notification: mark it read and go where it points. Only your own;
 *  anyone else's is "not found", so ids reveal nothing. */
export const GET: APIRoute = ({ params, cookies, redirect }) => {
  const me = currentPerson(cookies);
  const href = me ? openNote(me.id, Number(params.id)) : undefined;
  if (!me || !href) return new Response("No such notification", { status: 404 });
  publish(`person:${me.id}`, "inbox");
  return redirect(href.startsWith("/") && !href.startsWith("//") ? href : "/inbox", 303);
};
