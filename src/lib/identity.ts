import type { AstroCookies } from "astro";
import { getGroup, type Group, type Member, memberByToken } from "./db";

// Who you are in Hangout is a name and a cookie, one per group: no accounts,
// no passwords. Joining a group by its invite link sets the cookie; coming
// back in the same browser finds you again.

const PREFIX = "hg_";
const cookieName = (groupId: string) => `${PREFIX}${groupId}`;

export function remember(cookies: AstroCookies, url: URL, groupId: string, token: string): void {
  cookies.set(cookieName(groupId), token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // https behind Fly's proxy; plain http on localhost, where a Secure
    // cookie would be dropped by some browsers
    secure: url.protocol === "https:",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function currentMember(cookies: AstroCookies, groupId: string): Member | undefined {
  const token = cookies.get(cookieName(groupId))?.value;
  return token ? memberByToken(groupId, token) : undefined;
}

/** Every group this browser is a member of, read from the request's
 *  cookies, so coming back to the front page finds your groups. */
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
