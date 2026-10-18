import type { AstroCookies } from "astro";
import { db } from "./db";
import { currentMember, currentPerson } from "./identity";
import { activity } from "./schema";

// Crit 10: who did what, server-side, and the logging outlives the crit.
//
// Every state change, and every refusal, goes two places:
//   - one line on stdout, which Fly captures into `flyctl logs`:
//       [activity] 2026-10-21T03:14:05Z p12 "Ana" proposed hangout 41 in group abc → ok
//   - one row in the append-only `activity` table, on the volume, so it's
//     still there after a restart or a redeploy (scripts/activity.ts reads it)
//
// The actor is a stable label that tells people apart without a secret: `p12
// "Ana"` (profile 12), `m7 "Ben"` (a group member who has no profile yet) or
// `anon`. NEVER log a token, cookie, friend code or sign-in link, and never a
// message body: say "commented on hangout 41", with a length at most.

export type Activity = {
  /** From `whoIs()`, `personLabel()` or `memberLabel()`. */
  who: string;
  /** A verb phrase: "saved hours", "proposed hangout". */
  action: string;
  /** What it was done to: "hangout 41 in group abc". */
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
    const detail = a.detail ? clean(a.detail, 120) : null;
    const line = `[activity] ${at} ${a.who} ${a.action} ${a.target} → ${a.outcome}${detail ? ` (${detail})` : ""}`;
    console.log(line);
    const id = /^p(\d+) /.exec(a.who)?.[1];
    db.insert(activity)
      .values({
        at,
        actorId: id ? Number(id) : null,
        actorLabel: a.who,
        action: a.action,
        target: a.target,
        outcome: a.outcome,
        detail,
      })
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
