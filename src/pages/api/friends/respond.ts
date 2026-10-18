import type { APIRoute } from "astro";
import { logActivity, personLabel } from "../../../lib/activity";
import { flash } from "../../../lib/flash";
import { safeBack } from "../../../lib/forms";
import { accept, relationship, removeTie } from "../../../lib/friends";
import { currentPerson } from "../../../lib/identity";
import { publish } from "../../../lib/live";
import { notify } from "../../../lib/notify";

/** Accept or decline a request someone sent you, or remove a friend (which
 *  also cancels a request you sent). */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const back = safeBack(form.get("back"), "/friends");
  const me = currentPerson(cookies);
  const them = Number(form.get("person"));
  // only someone you already have a tie with: anyone else is as good as not there
  if (!me || !Number.isInteger(them) || relationship(me.id, them) === "none") return redirect(back, 303);

  const action = String(form.get("action") ?? "");
  publish(`person:${them}`, "friends");
  publish(`person:${me.id}`, "friends");
  // log what happened, never the action text as sent
  const log = (done: string) => logActivity({ who: personLabel(me), action: done, target: `p${them}`, outcome: "ok" });
  if (action === "accept" && relationship(me.id, them) === "received") {
    accept(me.id, them);
    log("accepted a friend request from");
    flash(cookies, "befriended");
    notify([them], { kind: "friend", text: `${me.name} accepted your friend request`, href: "/friends", actorId: me.id });
  } else if (action === "decline") {
    removeTie(me.id, them);
    log("declined a friend request from");
    flash(cookies, "declined");
  } else if (action === "remove") {
    removeTie(me.id, them);
    log("unfriended");
    flash(cookies, "unfriended");
  }
  return redirect(back, 303);
};
