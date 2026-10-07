import type { APIRoute } from "astro";
import { flash } from "../../../lib/flash";
import { currentPerson, rememberPerson } from "../../../lib/identity";
import { newToken } from "../../../lib/people";

/** A fresh private sign-in link. The old one stops working, which signs out
 *  every other device that was using it. */
export const POST: APIRoute = ({ cookies, redirect, url }) => {
  const person = currentPerson(cookies);
  if (!person) return redirect("/me", 303);
  rememberPerson(cookies, url, newToken(person.id).token);
  flash(cookies, "newLink");
  return redirect("/me", 303);
};
