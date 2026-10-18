import type { APIRoute } from "astro";
import { deny, groupRef, logActivity, personLabel, refuse } from "../../../../lib/activity";
import { addMember, getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { field } from "../../../../lib/forms";
import { currentPerson, remember, rememberPerson } from "../../../../lib/identity";
import { isBanned } from "../../../../lib/manage";
import { claimMembers, createPerson, memberOfPerson } from "../../../../lib/people";

/** Join a group from its invite link, under a name nobody in it has yet. */
export const POST: APIRoute = async ({ params, request, cookies, redirect, url }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "joined", groupRef(params.id), "not found", 404, "No such group");

  const name = field((await request.formData()).get("name"), 40);
  if (!name) return redirect(`/g/${group.id}?error=name-missing`, 303);

  // already in it under your profile: nothing to join
  let person = currentPerson(cookies);
  if (person && memberOfPerson(group.id, person.id)) return redirect(`/g/${group.id}`, 303);
  if (person && isBanned(group.id, person.id)) {
    deny(cookies, "joined", groupRef(group), "removed by admin");
    return redirect(`/g/${group.id}?error=removed`, 303);
  }

  const member = addMember(group.id, name, person?.id);
  if (!member) {
    deny(cookies, "joined", groupRef(group), "name taken");
    return redirect(`/g/${group.id}?error=name-taken`, 303);
  }

  remember(cookies, url, group.id, member.token);
  // joining by link is the other way most people make their profile
  if (!person) {
    person = createPerson({ name, timezone: group.timezone });
    rememberPerson(cookies, url, person.token);
    claimMembers(person.id, [member.id]);
  }
  logActivity({ who: personLabel(person), action: "joined", target: groupRef(group), outcome: "ok", detail: `as m${member.id} "${name}"` });
  publish(`group:${group.id}`, "people");
  flash(cookies, "joined");
  return redirect(`/g/${group.id}`, 303);
};
