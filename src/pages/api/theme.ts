import type { APIRoute } from "astro";
import { isMode, isTheme } from "../../lib/theme";

const YEAR = 60 * 60 * 24 * 365;

/** Remember a colour theme or light/dark mode, then go back to the page the
 *  picker was on. Each submit button carries only its own choice, so picking
 *  a colour leaves the mode alone and vice versa. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const options = {
    path: "/",
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
    maxAge: YEAR,
  };

  const theme = form.get("theme");
  if (isTheme(theme)) cookies.set("theme", theme, options);
  const mode = form.get("mode");
  if (isMode(mode)) cookies.set("mode", mode, options);

  // Only ever back to a path on this site.
  const back = String(form.get("back") ?? "/");
  return redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/", 303);
};
