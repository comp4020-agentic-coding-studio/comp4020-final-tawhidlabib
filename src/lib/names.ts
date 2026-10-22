// What someone typed, made into the text they meant. The same name can
// arrive as different bytes: "e-acute" as one code point or as "e" and a
// combining accent (NFC and NFD: a Mac and a phone disagree), letters in
// full-width form, or with a zero-width space pasted in from a chat. NFKC
// folds the first two into one spelling, and dropping format characters
// (\p{Cf}: zero-width spaces and joiners, direction marks, a stray BOM)
// takes out the third. Runs of any whitespace, the no-break space included,
// become one space.
//
// Emoji are built from format characters too: a zero-width joiner glues
// "woman" and "laptop" into one "woman technologist", and tag characters
// after a black flag spell the flags of England and Scotland. A joiner
// between two pictographs and the tags after a black flag stay; every other
// format character goes.
const INVISIBLE =
  /(?<!\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]?)\u{200D}|\u{200D}(?!\p{Extended_Pictographic})|(?<![\u{1F3F4}\u{E0020}-\u{E007F}])[\u{E0020}-\u{E007F}]|[^\P{Cf}\u{200D}\u{E0020}-\u{E007F}]/gu;

/** Text as it should be shown and stored: NFKC, no invisible format
 *  characters, whitespace collapsed and trimmed. */
export function tidy(text: string): string {
  return text.normalize("NFKC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** What two names have to share to count as the same name in a group. */
export const nameKey = (name: string) => tidy(name).toLowerCase();
