import type { APIRoute } from "astro";
import { flash } from "../../../lib/flash";

/** Log out on this device: forget the profile and every group's cookie, so
 *  this browser is nobody again. The private sign-in link brings you back
 *  (ADR 4); nothing on the server changes. */
export const POST: APIRoute = ({ request, cookies, redirect }) => {
  cookies.delete("hp", { path: "/" });
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const name = pair.trim().split("=")[0];
    if (name?.startsWith("hg_")) cookies.delete(name, { path: "/" });
  }
  flash(cookies, "loggedOut");
  return redirect("/welcome", 303);
};
