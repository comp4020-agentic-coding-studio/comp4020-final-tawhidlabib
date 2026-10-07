import type { APIRoute } from "astro";
import { flash } from "../../lib/flash";
import { field, safeBack } from "../../lib/forms";
import { requestFriend } from "../../lib/friends";
import { currentPerson } from "../../lib/identity";
import { personByCode, personById } from "../../lib/people";

/** Ask to be someone's friend: by their friend link's code, or by their id
 *  (the one-tap "Add friend" next to people you share a group with). If they
 *  already asked you, you're friends straight away. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const back = safeBack(form.get("back"), "/friends");
  const me = currentPerson(cookies);
  if (!me) return redirect("/friends", 303);

  const code = field(form.get("code"), 32);
  const id = Number(form.get("person"));
  const them = code ? personByCode(code) : Number.isInteger(id) ? personById(id) : undefined;
  if (!them || them.id === me.id) return redirect(back, 303);

  const now = requestFriend(me.id, them.id);
  if (now === "sent") flash(cookies, "requested");
  if (now === "friends") flash(cookies, "befriended");
  return redirect(back, 303);
};
