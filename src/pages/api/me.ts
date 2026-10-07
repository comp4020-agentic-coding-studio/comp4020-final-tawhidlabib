import type { APIRoute } from "astro";
import { flash } from "../../lib/flash";
import { field, safeBack } from "../../lib/forms";
import { currentPerson, rememberPerson, yourGroups } from "../../lib/identity";
import { setAvatar, isAvatarEmoji } from "../../lib/avatars";
import { db } from "../../lib/db";
import { claimMembers, createPerson, renamePerson } from "../../lib/people";
import { people } from "../../lib/schema";
import { eq } from "drizzle-orm";
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
    // a bio, and an emoji avatar, when the form sends them
    if (form.has("bio")) {
      const bio = String(form.get("bio") ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
      db.update(people).set({ bio: bio || null }).where(eq(people.id, person.id)).run();
    }
    if (form.has("avatarEmoji")) {
      const emoji = form.get("avatarEmoji");
      setAvatar(person.id, { avatarEmoji: isAvatarEmoji(emoji) ? String(emoji) : null });
    }
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
