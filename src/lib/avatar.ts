/** Up to two initials for a name: "Ana Lim" → "AL", "ben" → "B". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? "?"))
    .toUpperCase();
}

/** A stable hue per name, so the same person keeps the same colour. */
export function hue(name: string): number {
  let h = 0;
  for (const char of name.toLowerCase()) h = (h * 31 + char.codePointAt(0)!) % 360;
  return h;
}
