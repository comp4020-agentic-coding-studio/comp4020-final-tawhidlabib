import type { APIRoute } from "astro";
import { logActivity, personLabel } from "../../lib/activity";
import { block, unblock } from "../../lib/blocks";
import { flash } from "../../lib/flash";
import { field, safeBack } from "../../lib/forms";
import { currentPerson } from "../../lib/identity";
import { publish } from "../../lib/live";
import { knownPerson } from "../../lib/circle";
import { personByCode } from "../../lib/people";

/** Block or unblock someone, by their friend code or id. They aren't told. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  const form = await request.formData();
  // a code is what they were given; an id only reaches people you know of
  const code = field(form.get("code"), 32);
  const back = safeBack(form.get("back"), code ? `/f/${encodeURIComponent(code)}` : "/friends");
  if (!me) return redirect(back, 303);
  const them = code ? personByCode(code) : knownPerson(me, Number(form.get("person")), request.headers.get("cookie"));
  if (!them || them.id === me.id) return redirect(back, 303);

  if (form.get("action") === "unblock") {
    unblock(me.id, them.id);
    logActivity({ who: personLabel(me), action: "unblocked", target: `p${them.id} "${them.name}"`, outcome: "ok" });
    flash(cookies, "unblocked");
  } else {
    block(me.id, them.id);
    logActivity({ who: personLabel(me), action: "blocked", target: `p${them.id} "${them.name}"`, outcome: "ok" });
    flash(cookies, "blocked");
  }
  publish(`person:${me.id}`, "friends");
  return redirect(back, 303);
};
