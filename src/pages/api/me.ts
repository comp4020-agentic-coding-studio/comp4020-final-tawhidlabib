import type { APIRoute } from "astro";
import { logActivity, personLabel } from "../../lib/activity";
import { flash } from "../../lib/flash";
import { field, safeBack } from "../../lib/forms";
import { currentPerson, rememberPerson, yourGroups } from "../../lib/identity";
import { setAvatar, isAvatarEmoji } from "../../lib/avatars";
import { db } from "../../lib/db";
import { claimMembers, createPerson, publishPersonChanged, renamePerson } from "../../lib/people";
import { people } from "../../lib/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_TIMEZONE, isTimezone } from "../../lib/time";

/** Make your profile, or rename it. Making one claims every group this
 *  browser was already in, so nothing you did before is lost. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const back = safeBack(form.get("back"));
  const name = field(form.get("name"), 40);
  const person = currentPerson(cookies);
  // a blank name (spaces, or only invisible characters) is no name: say so on
  // /me, where the name box is, rather than quietly keeping the old one
  if (!name) return redirect(person ? "/me?error=name-missing" : back, 303);

  if (person) {
    renamePerson(person.id, name);
    logActivity({ who: personLabel(person), action: "updated profile", target: `p${person.id}`, outcome: "ok", detail: `name now "${name}"` });
    // a bio, and an emoji avatar, when the form sends them
    if (form.has("bio")) {
      const bio = String(form.get("bio") ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
      db.update(people).set({ bio: bio || null }).where(eq(people.id, person.id)).run();
    }
    if (form.has("avatarEmoji")) {
      const emoji = form.get("avatarEmoji");
      setAvatar(person.id, { avatarEmoji: isAvatarEmoji(emoji) ? String(emoji) : null });
    }
    publishPersonChanged(person.id, "profile");
    flash(cookies, "renamed");
    return redirect(back, 303);
  }

  const tz = field(form.get("timezone"), 64);
  const created = createPerson({ name, timezone: isTimezone(tz) ? tz : DEFAULT_TIMEZONE });
  rememberPerson(cookies, url, created.token);
  logActivity({ who: personLabel(created), action: "created profile", target: `p${created.id}`, outcome: "ok" });
  claimMembers(
    created.id,
    yourGroups(request.headers.get("cookie")).map((g) => g.member.id),
  );
  flash(cookies, "welcome");
  return redirect(back, 303);
};
