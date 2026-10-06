import type { APIRoute } from "astro";
import { createGroup } from "../../lib/db";
import { field } from "../../lib/forms";
import { remember } from "../../lib/identity";
import { DEFAULT_TIMEZONE, isTimezone } from "../../lib/time";

/** Start a group: its creator is its first member. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const name = field(form.get("group"), 60);
  const you = field(form.get("name"), 40);
  if (!name || !you) return redirect("/?error=missing", 303);

  const tz = field(form.get("timezone"), 64);
  const { group, member } = createGroup({
    name,
    you,
    timezone: isTimezone(tz) ? tz : DEFAULT_TIMEZONE,
  });
  remember(cookies, url, group.id, member.token);
  return redirect(`/g/${group.id}`, 303);
};
