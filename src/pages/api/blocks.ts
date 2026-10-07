import type { APIRoute } from "astro";
import { block, unblock } from "../../lib/blocks";
import { flash } from "../../lib/flash";
import { field, safeBack } from "../../lib/forms";
import { currentPerson } from "../../lib/identity";
import { publish } from "../../lib/live";
import { personByCode, personById } from "../../lib/people";

/** Block or unblock someone, by their friend code or id. They aren't told. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  const form = await request.formData();
  const code = field(form.get("code"), 32);
  const them = code ? personByCode(code) : personById(Number(form.get("person")));
  const back = safeBack(form.get("back"), them ? `/f/${them.friendCode}` : "/friends");
  if (!me || !them || them.id === me.id) return redirect(back, 303);

  if (form.get("action") === "unblock") {
    unblock(me.id, them.id);
    flash(cookies, "unblocked");
  } else {
    block(me.id, them.id);
    flash(cookies, "blocked");
  }
  publish(`person:${me.id}`, "friends");
  return redirect(back, 303);
};
