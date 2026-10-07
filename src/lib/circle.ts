import { listMembers } from "./db";
import { friendsOf, relationship } from "./friends";
import { groupsFor } from "./identity";
import { peopleByIds, type Person } from "./people";

// The people around someone: who they share groups with, and which of those
// aren't friends yet ("people you may know"). Only ever people from groups
// they're in --- nobody is suggested from outside them.

export function sharedGroups(
  person: Person,
  cookieHeader: string | null,
): Map<number, string[]> {
  const shared = new Map<number, string[]>();
  for (const { group } of groupsFor(person, cookieHeader)) {
    for (const m of listMembers(group.id)) {
      if (m.personId === null || m.personId === person.id) continue;
      shared.set(m.personId, [...(shared.get(m.personId) ?? []), group.name]);
    }
  }
  return shared;
}

export function mayKnow(person: Person, cookieHeader: string | null): Person[] {
  const shared = sharedGroups(person, cookieHeader);
  const candidates = [...shared.keys()].filter((id) => relationship(person.id, id) === "none");
  return peopleByIds(candidates).sort((a, b) => a.name.localeCompare(b.name));
}

/** Who someone can invite to an event: their friends. */
export const invitable = (person: Person) => friendsOf(person.id);
