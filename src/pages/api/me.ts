import type { APIRoute } from "astro";
import { flash } from "../../lib/flash";
import { field, safeBack } from "../../lib/forms";
import { currentPerson, rememberPerson, yourGroups } from "../../lib/identity";
import { claimMembers, createPerson, renamePerson } from "../../lib/people";
import { DEFAULT_TIMEZONE, isTimezone } from "../../lib/time";

/** Make your profile, or rename it. Making one claims every group this
 *  browser was already in, so nothing you did before is lost. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const back = safeBack(form.get("back"));
  const name = field(form.get("name"), 40);
  if (!name) return redirect(back, 303);

  const person = currentPerson(cookies);
  if (person) {
    renamePerson(person.id, name);
    flash(cookies, "renamed");
    return redirect(back, 303);
  }

  const tz = field(form.get("timezone"), 64);
  const created = createPerson({ name, timezone: isTimezone(tz) ? tz : DEFAULT_TIMEZONE });
  rememberPerson(cookies, url, created.token);
  claimMembers(
    created.id,
    yourGroups(request.headers.get("cookie")).map((g) => g.member.id),
  );
  flash(cookies, "welcome");
  return redirect(back, 303);
};
