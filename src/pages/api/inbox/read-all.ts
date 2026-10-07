import type { APIRoute } from "astro";
import { currentPerson } from "../../../lib/identity";
import { publish } from "../../../lib/live";
import { readAll } from "../../../lib/notify";

/** Mark everything in your inbox read. */
export const POST: APIRoute = ({ cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (me) {
    readAll(me.id);
    publish(`person:${me.id}`, "inbox");
  }
  return redirect("/inbox", 303);
};
