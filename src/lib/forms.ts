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
};
