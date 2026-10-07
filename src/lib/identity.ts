import type { AstroCookies } from "astro";
import { getGroup, type Group, type Member, memberByToken } from "./db";
import { claimMembers, groupsOfPerson, memberOfPerson, type Person, personByToken } from "./people";

// Who you are in Hangout. Two layers, oldest first:
//
// - per group, a name and an `hg_<group>` cookie: joining by invite link sets
//   it, and it's still how a group recognises you in this browser
// - across groups, a profile in the `hp` cookie (ADR 4): a name, your groups,
//   your friends, your events, and a private sign-in link for other devices
//
// A membership made before you had a profile is claimed by it the first time
// both are seen together.

const PREFIX = "hg_";
const PERSON = "hp";
const cookieName = (groupId: string) => `${PREFIX}${groupId}`;
const YEAR = 60 * 60 * 24 * 365;

const options = (url: URL) => ({
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  // https behind Fly's proxy; plain http on localhost, where a Secure
  // cookie would be dropped by some browsers
  secure: url.protocol === "https:",
  maxAge: YEAR,
});

export function remember(cookies: AstroCookies, url: URL, groupId: string, token: string): void {
  cookies.set(cookieName(groupId), token, options(url));
}

export function rememberPerson(cookies: AstroCookies, url: URL, token: string): void {
  cookies.set(PERSON, token, options(url));
}

export function currentPerson(cookies: AstroCookies): Person | undefined {
  const token = cookies.get(PERSON)?.value;
  return token ? personByToken(token) : undefined;
}

/** You, as this group knows you: by its cookie first, otherwise by your
 *  profile. A cookie membership with no profile yet is claimed by yours. */
export function currentMember(cookies: AstroCookies, groupId: string): Member | undefined {
  const token = cookies.get(cookieName(groupId))?.value;
  const byCookie = token ? memberByToken(groupId, token) : undefined;
  const person = currentPerson(cookies);
  if (byCookie) {
    if (person && byCookie.personId === null) {
      claimMembers(person.id, [byCookie.id]);
      return { ...byCookie, personId: person.id };
    }
    return byCookie;
  }
  return person ? memberOfPerson(groupId, person.id) : undefined;
}

/** Every group this browser holds a membership cookie for. */
export function yourGroups(cookieHeader: string | null): { group: Group; member: Member }[] {
  const found: { group: Group; member: Member }[] = [];
  for (const pair of (cookieHeader ?? "").split(";")) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (!rawName?.startsWith(PREFIX)) continue;
    const groupId = rawName.slice(PREFIX.length);
    const group = getGroup(groupId);
    const member = group && memberByToken(groupId, decodeURIComponent(rest.join("=")));
    if (group && member) found.push({ group, member });
  }
  return found;
}

/** Every group you're in: by your profile, plus any this browser holds a
 *  membership cookie for that the profile hasn't claimed yet. */
export function groupsFor(
  person: Person | undefined,
  cookieHeader: string | null,
): { group: Group; member: Member }[] {
  const byGroup = new Map<string, { group: Group; member: Member }>();
  for (const g of person ? groupsOfPerson(person.id) : []) byGroup.set(g.group.id, g);
  for (const g of yourGroups(cookieHeader)) if (!byGroup.has(g.group.id)) byGroup.set(g.group.id, g);
  return [...byGroup.values()].sort((a, b) => a.group.name.localeCompare(b.group.name));
}
