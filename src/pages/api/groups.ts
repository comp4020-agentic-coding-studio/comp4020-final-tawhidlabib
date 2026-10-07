import type { APIRoute } from "astro";
import { createGroup } from "../../lib/db";
import { flash } from "../../lib/flash";
import { field } from "../../lib/forms";
import { currentPerson, remember, rememberPerson } from "../../lib/identity";
import { createPerson } from "../../lib/people";
import { DEFAULT_TIMEZONE, isTimezone } from "../../lib/time";

/** Start a group: its creator is its first member. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const name = field(form.get("group"), 60);
  const you = field(form.get("name"), 40);
  if (!name || !you) return redirect("/?error=missing", 303);

  const tz = field(form.get("timezone"), 64);
  const timezone = isTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  // starting a group is also how most people make their profile
  let person = currentPerson(cookies);
  if (!person) {
    person = createPerson({ name: you, timezone });
    rememberPerson(cookies, url, person.token);
  }
  const { group, member } = createGroup({ name, you, timezone, personId: person.id });
  remember(cookies, url, group.id, member.token);
  flash(cookies, "created");
  return redirect(`/g/${group.id}`, 303);
};
