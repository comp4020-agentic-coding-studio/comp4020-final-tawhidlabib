import type { APIRoute } from "astro";
import { safeBack } from "../../lib/forms";

const YEAR = 60 * 60 * 24 * 365;

/** Dismiss the "Keep your spot" card. Only a cookie: nothing about the
 *  person changes, so there is nothing to publish or log. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  cookies.set("keep-spot", "done", { path: "/", sameSite: "lax", secure: url.protocol === "https:", maxAge: YEAR });
  return redirect(safeBack(form.get("back")), 303);
};
