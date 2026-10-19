import type { APIRoute } from "astro";
import { logActivity, personLabel, whoIs } from "../../../lib/activity";
import { flash } from "../../../lib/flash";
import { currentPerson, rememberPerson } from "../../../lib/identity";
import { newToken } from "../../../lib/people";

/** Two ways out (ADR 4).
 *
 *  - On this device (the default): forget the profile and every group's
 *    cookie, so this browser is nobody again. Nothing on the server
 *    changes; the private sign-in link brings you back.
 *  - Everywhere else (`scope=everywhere`): a new token, so every other
 *    device, every copy of the old cookie and the old link stop working.
 *    This device stays signed in with the new link: there's no password,
 *    so signing out every device at once would leave nobody holding it. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  // a bodiless POST is "this device", as it always was
  const form = await request.formData().catch(() => new FormData());

  if (form.get("scope") === "everywhere") {
    const person = currentPerson(cookies);
    if (!person) return redirect("/me", 303);
    rememberPerson(cookies, url, newToken(person.id).token);
    logActivity({ who: personLabel(person), action: "logged out", target: "every other device", outcome: "ok", detail: "sign-in link replaced" });
    flash(cookies, "newLink");
    return redirect("/me", 303);
  }

  logActivity({ who: whoIs(cookies), action: "logged out", target: "this device", outcome: "ok" });
  cookies.delete("hp", { path: "/" });
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const name = pair.trim().split("=")[0];
    if (name?.startsWith("hg_")) cookies.delete(name, { path: "/" });
  }
  flash(cookies, "loggedOut");
  return redirect("/welcome", 303);
};
