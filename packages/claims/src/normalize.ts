/**
 * Common Cyrillic/Greek letters that are visually indistinguishable from
 * Latin ones in most fonts -- the classic "confusables" homoglyph attack.
 * NFKC alone does NOT fold these: Cyrillic and Latin are different scripts,
 * not compatibility variants of each other, so a Cyrillic "e" (U+0435) run
 * through `.normalize("NFKC")` is still a Cyrillic "e", not a Latin one.
 * These map keys are deliberately literal Cyrillic/Greek characters --
 * that is what they need to be, to match real input.
 */
const CONFUSABLES: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  і: "i",
  ѕ: "s",
  ј: "j",
  А: "A",
  Е: "E",
  О: "O",
  Р: "P",
  С: "C",
  Х: "X",
  І: "I",
  α: "a",
  ο: "o",
  υ: "u",
  ρ: "p",
};

/**
 * Zero-width space, zero-width non-joiner, zero-width joiner, BOM / zero-
 * width no-break space, and word joiner -- invisible characters that can
 * split a flagged word in two, e.g. "exp" + ZWSP + "ert". Built from
 * numeric code points at runtime rather than written as literal characters
 * in this file: an actual invisible character sitting in source code is
 * unreviewable (it doesn't show up in a diff or an editor), so the numbers
 * below are the only trustworthy representation of what this matches.
 */
const INVISIBLE_CODE_POINTS = [0x200b, 0x200c, 0x200d, 0xfeff, 0x2060];
const INVISIBLE_CHARS = new RegExp(
  `[${INVISIBLE_CODE_POINTS.map((codePoint) => String.fromCharCode(codePoint)).join("")}]`,
  "g",
);

/**
 * Applied before every lexicon/entity/quantity match in this package.
 * Without it, a zero-width space inside "expert" or a Cyrillic look-alike
 * in "led" silently evades a plain-string or regex match.
 */
export function normalizeForMatching(text: string): string {
  const stripped = text.normalize("NFKC").replace(INVISIBLE_CHARS, "");
  return Array.from(stripped)
    .map((ch) => CONFUSABLES[ch] ?? ch)
    .join("");
}
