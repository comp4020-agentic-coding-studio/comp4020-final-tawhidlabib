import type { APIRoute } from "astro";
import { flash } from "../../../lib/flash";
import { field } from "../../../lib/forms";
import { rememberPerson } from "../../../lib/identity";
import { personByToken } from "../../../lib/people";

/** Become the person whose sign-in link this is, on this device. A POST from
 *  the link's page, never the link itself, so previews can't sign anyone in. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const token = field((await request.formData()).get("token"), 64);
  const person = token ? personByToken(token) : undefined;
  if (!person) return redirect("/me?error=bad-link", 303);
  rememberPerson(cookies, url, person.token);
  flash(cookies, "signedIn");
  return redirect("/", 303);
};
