import type { APIRoute } from "astro";
import { flash } from "../../../lib/flash";
import { safeBack } from "../../../lib/forms";
import { accept, relationship, removeTie } from "../../../lib/friends";
import { currentPerson } from "../../../lib/identity";

/** Accept or decline a request someone sent you, or remove a friend (which
 *  also cancels a request you sent). */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const back = safeBack(form.get("back"), "/friends");
  const me = currentPerson(cookies);
  const them = Number(form.get("person"));
  if (!me || !Number.isInteger(them)) return redirect(back, 303);

  const action = String(form.get("action") ?? "");
  if (action === "accept" && relationship(me.id, them) === "received") {
    accept(me.id, them);
    flash(cookies, "befriended");
  } else if (action === "decline") {
    removeTie(me.id, them);
    flash(cookies, "declined");
  } else if (action === "remove") {
    removeTie(me.id, them);
    flash(cookies, "unfriended");
  }
  return redirect(back, 303);
};
