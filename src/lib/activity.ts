import { createHash } from "node:crypto";
import type { AstroCookies } from "astro";
import { db } from "./db";
import { currentMember, currentPerson } from "./identity";
import { activity } from "./schema";

// Crit 10: who did what, server-side, and the logging outlives the crit.
//
// Every state change, and every refusal, goes two places:
//   - one line on stdout, which Fly captures into `flyctl logs`:
//       [activity] 2026-10-21T03:14:05Z p12 "Ana" proposed hangout 41 in group #3f9a1c "Uni mates" → ok
//       [activity] 2026-10-21T03:15:40Z p13 "Ben" answered event 9 "Dumpling night" → denied (private event)
//   - one row in the append-only `activity` table, on the volume, so it's
//     still there after a restart or a redeploy (scripts/activity.ts reads it)
//
// The actor is a stable label that tells people apart without a secret: `p12
// "Ana"` (profile 12), `m7 "Ben"` (a group member who has no profile yet) or
// `anon`. NEVER log a token, cookie, friend code or sign-in link, and never a
// message body: say "commented on hangout 41", with a length at most.
//
// A group's id and an event's share id are secrets too: the first is the
// invite link, the second opens a private event. So name them with
// `groupRef()` and `eventRef()`, never `${group.id}` or `${event.shareId}`.

export type Activity = {
  /** From `whoIs()`, `personLabel()` or `memberLabel()`. */
  who: string;
  /** A verb phrase that reads into the target: "saved hours in", "proposed". */
  action: string;
  /** What it was done to: "hangout 41 in group #3f9a1c \"Uni mates\"". */
  target: string;
  /** "ok", or "denied (reason)". */
  outcome: string;
  /** Short and non-secret: counts, never text people wrote. */
  detail?: string;
};

/** Names are free text: keep a line a line, and the label short. */
const clean = (text: string, max = 60) =>
  text
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, " ")
    .trim()
    .slice(0, max);

export const personLabel = (p: { id: number; name: string }) => `p${p.id} "${clean(p.name, 40)}"`;
export const memberLabel = (m: { id: number; name: string }) => `m${m.id} "${clean(m.name, 40)}"`;

/** Six hex characters of a SHA-256: the same group always reads the same,
 *  and the tag can't be turned back into the invite link. */
const tag = (secret: string) => createHash("sha256").update(secret).digest("hex").slice(0, 6);

/** A group, by tag and name. Given only the id someone asked for (a group
 *  that wasn't found), the tag alone: what they typed might be a near-miss
 *  of a real invite. */
export const groupRef = (group: { id: string; name: string } | string | undefined) =>
  typeof group === "object" ? `group #${tag(group.id)} "${clean(group.name, 40)}"` : `group #${tag(group ?? "")}`;

/** An event, by its numeric id (not the share id, which opens a private one)
 *  and title. */
export const eventRef = (event: { id: number; title: string } | undefined) =>
  event ? `event ${event.id} "${clean(event.title, 40)}"` : "event (no such)";

/** Whoever this request is from: their profile if they have one, else their
 *  membership of `groupId`, else nobody. Reads cookies, never prints them. */
export function whoIs(cookies: AstroCookies, groupId?: string): string {
  try {
    const person = currentPerson(cookies);
    if (person) return personLabel(person);
    const member = groupId ? currentMember(cookies, groupId) : undefined;
    return member ? memberLabel(member) : "anon";
  } catch {
    return "anon";
  }
}

/** The target for something on a plan's thread, whether or not it was found. */
export const threadTarget = (
  thread: { kind: string; target: { id: number } } | undefined,
  kind: unknown,
): string => (thread ? `${thread.kind} ${thread.target.id}` : clean(String(kind ?? "plan"), 20));

/** Record one thing someone did. Never throws: a logging fault must not
 *  turn a request into an error. */
export function logActivity(a: Activity): void {
  try {
    const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    // every field, not just detail: one newline from a form and the next
    // "line" in flyctl logs is whatever someone typed
    const who = clean(a.who, 60);
    const action = clean(a.action, 60);
    const target = clean(a.target, 160);
    const outcome = clean(a.outcome, 80);
    const detail = a.detail ? clean(a.detail, 120) : null;
    const line = `[activity] ${at} ${who} ${action} ${target} → ${outcome}${detail ? ` (${detail})` : ""}`;
    console.log(line);
    const id = /^p(\d+) /.exec(who)?.[1];
    db.insert(activity)
      .values({ at, actorId: id ? Number(id) : null, actorLabel: who, action, target, outcome, detail })
      .run();
  } catch (error) {
    try {
      console.error("[activity] could not record:", error instanceof Error ? error.message : "unknown");
    } catch {
      // nothing left to try
    }
  }
}

/** A refusal for an access reason (403, 404, 409): the log is how you show
 *  that one person couldn't change what was another's. */
export function deny(cookies: AstroCookies, action: string, target: string, reason: string, groupId?: string): void {
  logActivity({ who: whoIs(cookies, groupId), action, target, outcome: `denied (${reason})` });
}

/** The line format, for reading rows back (scripts/activity.ts). */
export function formatRow(r: {
  at: string;
  actorLabel: string;
  action: string;
  target: string;
  outcome: string;
  detail: string | null;
}): string {
  return `[activity] ${r.at} ${r.actorLabel} ${r.action} ${r.target} → ${r.outcome}${r.detail ? ` (${r.detail})` : ""}`;
}

/** Log a refusal and return it as the response, so a guard stays one line:
 *  `if (!me) return refuse(cookies, "saved hours", target, "not a member", 403, "Join the group first")`. */
export function refuse(
  cookies: AstroCookies,
  action: string,
  target: string,
  reason: string,
  status: number,
  message: string,
  groupId?: string,
): Response {
  deny(cookies, action, target, reason, groupId);
  return new Response(message, { status });
}
