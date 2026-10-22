import { tidy } from "./names";

/** A submitted text field, tidied (NFKC, no invisible format characters,
 *  whitespace collapsed and trimmed: see names.ts) and capped at `max`
 *  characters; "" when it's missing, not text, or nothing visible. */
export function field(value: FormDataEntryValue | null, max: number): string {
  if (typeof value !== "string") return "";
  return tidy(value).slice(0, max);
}

/** What a `?error=` code on a page means, in words a person can act on. */
export const ERRORS: Record<string, string> = {
  missing: "Fill in both names to start a group.",
  "name-missing": "Pick a name the group will recognise.",
  "name-taken":
    "Someone in this group already goes by that name. If that's you on another device, open your private sign-in link: it's on /me on the device you joined from. Otherwise, try another name or add an initial.",
  "bad-time": "That hangout's time didn't make sense. Pick a start before the end.",
  "bad-link": "That sign-in link doesn't work any more. Ask for a fresh one from /me.",
  "event-missing": "Give your event a name and a date.",
  "event-time": "Pick an end time that isn't the start. An end before the start runs into the next day.",
  "event-date": "Pick a date from today to five years ahead.",
  "event-capacity": "Spots should be a whole number from 1 to 1000, or empty for no limit.",
  "event-plus-ones": "+1s per guest should be none or up to 3.",
  "rsvp-closed": "RSVPs for this event have closed.",
  removed: "You were removed from this group, so you can't rejoin it.",
};

/** Where a form asked to go back to, if it's a path on this site; the
 *  fallback otherwise, so a crafted form can never send someone off-site.
 *  Browsers read `/\` as `//` and drop tabs and newlines inside a URL, so
 *  backslashes and control characters are refused outright, and what's
 *  returned is what the URL parser made of it (path, query, hash). */
export function safeBack(value: FormDataEntryValue | null, fallback = "/"): string {
  const back = typeof value === "string" ? value : "";
  if (!back.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(back)) return fallback;
  try {
    const url = new URL(back, "http://site.invalid");
    if (url.origin !== "http://site.invalid") return fallback;
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") ? fallback : path;
  } catch {
    return fallback;
  }
}
