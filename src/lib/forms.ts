/** A submitted text field, trimmed, with runs of whitespace collapsed and
 *  capped at `max` characters; "" when it's missing or not text. */
export function field(value: FormDataEntryValue | null, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

/** What a `?error=` code on a page means, in words a person can act on. */
export const ERRORS: Record<string, string> = {
  missing: "Fill in both names to start a group.",
  "name-missing": "Pick a name the group will recognise.",
  "name-taken":
    "Someone in this group already goes by that name. Try another, or add an initial.",
  "bad-time": "That hangout's time didn't make sense. Pick a start before the end.",
  "bad-link": "That sign-in link doesn't work any more. Ask for a fresh one from /me.",
  "event-missing": "Give your event a name and a date.",
  "event-time": "Pick an end time after the start.",
  "rsvp-closed": "RSVPs for this event have closed.",
  removed: "You were removed from this group, so you can't rejoin it.",
};

/** Where a form asked to go back to, if it's a path on this site; "/"
 *  otherwise, so a crafted form can never send someone off-site. */
export function safeBack(value: FormDataEntryValue | null, fallback = "/"): string {
  const back = typeof value === "string" ? value : "";
  return back.startsWith("/") && !back.startsWith("//") ? back : fallback;
}
