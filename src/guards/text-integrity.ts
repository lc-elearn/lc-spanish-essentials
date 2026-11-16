/**
 * text-integrity.ts — guard i: no invisible text mistakes in lesson content (TODO §E60).
 * Spec: docs/specs/2026-11-12-text-integrity-guard-design.md.
 *
 * THE BUG CLASS. Some mistakes in lesson text cannot be seen in an editor. The Russian
 * course shipped `(на ‹U+0301› Acc)` for `(на + Acc)` 33 times: a stress mark with no
 * letter under it. A Latin `e` inside a Russian word looks exactly like a Cyrillic one, but a
 * screen reader, a search and a typed-answer comparison all see a different word. An
 * accent pasted from a PDF as letter + separate mark looks right, and is a different
 * string from the one the learner types. Every course can make these, whatever it
 * teaches, so the checks live in the template and run in every course's CI.
 *
 * FOUR RULES, three needing no language knowledge (the spec's §2 has the table):
 *   1. `not-nfc`: the string equals its NFC form. Russian stress marks pass: Cyrillic
 *      vowels have no precomposed acute, so NFC keeps `о` + U+0301.
 *   2. `stray-mark`: a combining mark has a letter under it. A plain space under it is
 *      the Russian course's real mistake, so a mark shown on its own must sit on the
 *      dotted circle ◌ (U+25CC, as the code charts show it) or a no-break space (U+00A0,
 *      the Unicode Standard's way). Emoji variation selectors and the keycap mark belong
 *      to the emoji before them, and pass.
 *   3. `mixed-script`: one word holds letters from only one of Latin, Cyrillic and Greek,
 *      the scripts with look-alike letters. Others are not compared (Japanese mixes kanji
 *      and kana in one word by design). IPA's β θ χ are Greek code points, so a Latin
 *      word whose only Greek letters are these is a transcription and passes. Modifier
 *      letters (ʲ ʰ ˈ) are notation, not part of an alphabet: `[дʲ]` passes.
 *   4. `misplaced-mark`: under the course's language profile, a restricted mark sits on
 *      a letter it may. Only `ru` has one: U+0301 on a Cyrillic vowel. NFC composes a
 *      stress mark on к or г into one letter (Macedonian ќ, ѓ), so a letter of the same
 *      script that holds the mark is looked inside too. A precomposed letter of ANOTHER
 *      script is that script's own letter (the é of a French gloss) and passes.
 * Rules 2–4 read the NFC form, so a decomposed accent is reported once, by rule 1.
 *
 * WHAT IS SWEPT: every string VALUE in `lo-config/**\/*.json` and `course.json`, read
 * off disk (never through `load-lo-glob.ts`, which is Vite-only). A word is a run of
 * letters and marks, so HTML tags, spaces, digits and punctuation split words: an English
 * gloss beside a Russian word is two words.
 *
 * WHAT IS NOT SWEPT, AND WHY:
 *   - The showcase fixtures (`src/showcase/fixtures.ts`): the template's own demo text,
 *     the same in every course and reviewed by the maintainer. A course's language
 *     profile does not describe it (it is Spanish in the Russian course).
 *   - `text-integrity.test.ts`, which holds the mistakes on purpose; it is code, not a
 *     swept folder.
 *   - Asset paths (a string directly under guard d's `ASSET_KEYS`): not text a learner
 *     reads, and guard d owns them. A file name dragged from the Finder arrives NFD, and
 *     guard d and `resolveAsset()` accept either form, so rule 1 would fail a working path.
 *     The `alt` beside an image's `src` is text, and is swept.
 *   - JSON keys (schema field names, not authored text) and HTML entities (not decoded).
 *
 * KNOWN MISSES, left on purpose (spec §4): a variation selector is not checked for what
 * it sits on, and a spacing acute ´ (U+00B4) typed as a stress mark is not a combining
 * mark, so no rule sees it.
 *
 * FALSE POSITIVES COST MORE THAN MISSES: a failing guard stops an author's pull request.
 * Before it was turned on, the rules ran over the template's example lesson and all of
 * the Russian course's lessons and history (spec §5). Any widening of a rule needs the
 * same run first.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { toPosixPath } from '@/build/posix-path';
import { ASSET_KEYS, loConfigFiles } from './asset-existence';

/** Which rule a problem broke; the spec's §2 names them the same way. */
export type TextProblemKind = 'not-nfc' | 'stray-mark' | 'mixed-script' | 'misplaced-mark';

/** One mistake, described so an author can find it: marks are written `‹U+0301›`. */
export interface TextProblem {
  readonly kind: TextProblemKind;
  readonly detail: string;
}

/** What one language adds to the rules every course gets. */
export interface LanguageProfile {
  /** A combining mark the language restricts → every letter it may sit on. */
  readonly markBases: Readonly<Record<string, string>>;
}

/**
 * Per-language rules, keyed on the primary subtag of `course.json`'s `languageCode`.
 * Only rules that need the language belong here; a code with no entry gets rules 1–3.
 * `ё` is in Russian's list although it is always stressed: a mark on it is redundant,
 * not wrong, and the course author's own script accepts it.
 */
export const LANGUAGE_PROFILES: Readonly<Record<string, LanguageProfile>> = {
  ru: { markBases: { '\u0301': 'аеёиоуыэюяАЕЁИОУЫЭЮЯ' } },
};

/** The profile for a course's language code (`ru`, `ru-RU`, `RU`), if it has one. */
export function profileFor(languageCode: string): LanguageProfile | undefined {
  const primary = languageCode.toLowerCase().split('-')[0] ?? '';
  return Object.hasOwn(LANGUAGE_PROFILES, primary) ? LANGUAGE_PROFILES[primary] : undefined;
}

const WORD = /[\p{L}\p{M}]+/gu;
const LETTER = /^\p{L}$/u;
const MARK = /^\p{M}$/u;
/** Marks that belong to an emoji (U+FE0F, the keycap U+20E3), not to a letter. */
const EMOJI_MARK = /^[\p{Variation_Selector}\p{Emoji_Component}]$/u;
/** What a mark shown on its own may sit on: the dotted circle ◌, or a no-break space. */
const ISOLATED_MARK_BASES = '\u25CC\u00A0';
/** Modifier letters (ʲ ʰ ˈ): notation, belonging to no word's alphabet. */
const MODIFIER_LETTER = /^\p{Lm}$/u;
/** The scripts that share look-alike letters, so a word may hold only one of them. */
const CONFUSABLE_SCRIPTS = [
  ['Latin', /^\p{Script=Latin}$/u],
  ['Cyrillic', /^\p{Script=Cyrillic}$/u],
  ['Greek', /^\p{Script=Greek}$/u],
] as const;
/** The Greek code points the IPA itself uses; in a Latin word they are a transcription. */
const IPA_GREEK = 'βθχ';
/** Code points shown either side of a mark, so the author can search for it. */
const CONTEXT = 12;
/** Words listed in one `not-nfc` problem before "and N more". */
const MAX_WORDS = 5;

/** `U+0301`, the name an author can search a character table for. */
function codePoint(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
}

/** The text with every combining mark written out, since a mark cannot be seen. */
function visible(text: string): string {
  return text.replace(/\p{M}/gu, (mark) => `‹${codePoint(mark)}›`);
}

/** The text around code point `index`, made visible. */
function around(chars: readonly string[], index: number): string {
  return visible(chars.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).join(''));
}

/** The character a mark at `index` sits on: the nearest one before it that is not a mark. */
function baseOf(chars: readonly string[], index: number): string | undefined {
  let at = index - 1;
  while (at >= 0 && MARK.test(chars[at] ?? '')) at -= 1;
  return chars[at];
}

/** `«as stored» should read «as NFC»`, both made visible. */
function shouldRead(text: string): string {
  return `«${visible(text)}» should read «${visible(text.normalize('NFC'))}»`;
}

/** Rule 1: the words that change under NFC, listed in one problem with what each should be. */
function notNfc(text: string): TextProblem[] {
  if (text === text.normalize('NFC')) return [];
  const words = (text.match(WORD) ?? []).filter((word) => word !== word.normalize('NFC'));
  const shown = words.slice(0, MAX_WORDS).map(shouldRead);
  const more = words.length > MAX_WORDS ? ` and ${words.length - MAX_WORDS} more` : '';
  const where = shown.length > 0 ? `${shown.join(', ')}${more}` : shouldRead(text);
  const detail = `not NFC (an accent stored as a separate mark, or a look-alike character): ${where}; type it again`;
  return [{ kind: 'not-nfc', detail }];
}

/** Rule 2: every mark with no letter under it. */
function strayMarks(chars: readonly string[]): TextProblem[] {
  return chars.flatMap((char, index) => {
    if (!MARK.test(char) || EMOJI_MARK.test(char)) return [];
    const base = baseOf(chars, index);
    if (base !== undefined && (LETTER.test(base) || ISOLATED_MARK_BASES.includes(base))) {
      return [];
    }
    const detail = `${codePoint(char)} has no letter under it in «${around(chars, index)}»`;
    return [{ kind: 'stray-mark' as const, detail }];
  });
}

/** The look-alike script a letter belongs to, if any. Modifier letters belong to none. */
function scriptOf(letter: string): string | undefined {
  if (MODIFIER_LETTER.test(letter)) return undefined;
  return CONFUSABLE_SCRIPTS.find(([, pattern]) => pattern.test(letter))?.[0];
}

/** Rule 3, for one word: letters from more than one look-alike script. */
function mixedScript(word: string): TextProblem[] {
  const byScript = new Map<string, string[]>();
  for (const letter of word) {
    const script = scriptOf(letter);
    if (script !== undefined) byScript.set(script, [...(byScript.get(script) ?? []), letter]);
  }
  const greek = byScript.get('Greek') ?? [];
  if (byScript.has('Latin') && greek.every((letter) => IPA_GREEK.includes(letter))) {
    byScript.delete('Greek');
  }
  if (byScript.size < 2) return [];

  const ranked = [...byScript].sort(([, a], [, b]) => b.length - a.length);
  const odd = ranked
    .slice(1)
    .flatMap(([script, letters]) =>
      [...new Set(letters)].map((letter) => `${letter} (${codePoint(letter)}) is ${script}`),
    );
  const scripts = ranked.map(([script]) => script).join(' and ');
  return [
    { kind: 'mixed-script', detail: `«${visible(word)}» mixes ${scripts}: ${odd.join(', ')}` },
  ];
}

/** A restricted mark on a letter its profile does not allow, as one problem or none. */
function misplaced(
  mark: string,
  base: string,
  where: string,
  profile: LanguageProfile,
): TextProblem[] {
  const allowed = profile.markBases[mark] ?? '';
  if (allowed.includes(base)) return [];
  const detail = `${codePoint(mark)} sits on «${base}» in «${where}»; the course's language allows it only on ${allowed}`;
  return [{ kind: 'misplaced-mark', detail }];
}

/**
 * Rule 4, for one NFC letter that holds a restricted mark inside it: к + U+0301 is
 * Macedonian ќ after NFC. Only a letter of the allowed letters' own script counts; a
 * precomposed letter of another script (a French é) is that script's own letter.
 */
function composedMisplaced(
  chars: readonly string[],
  index: number,
  profile: LanguageProfile,
): TextProblem[] {
  const [base, ...marks] = [...(chars[index] ?? '').normalize('NFD')];
  const mark = marks.find((entry) => Object.hasOwn(profile.markBases, entry));
  if (base === undefined || mark === undefined) return [];
  const allowedScript = scriptOf([...(profile.markBases[mark] ?? '')][0] ?? '');
  if (allowedScript === undefined || scriptOf(base) !== allowedScript) return [];
  return misplaced(mark, base, around(chars, index), profile);
}

/** Rule 4: a mark the language restricts, sitting on a letter it may not. */
function misplacedMarks(chars: readonly string[], profile: LanguageProfile): TextProblem[] {
  return chars.flatMap((char, index) => {
    if (!Object.hasOwn(profile.markBases, char)) return composedMisplaced(chars, index, profile);
    const base = baseOf(chars, index);
    // No letter under it at all is rule 2's to report, once.
    if (base === undefined || !LETTER.test(base)) return [];
    return misplaced(char, base, around(chars, index), profile);
  });
}

/**
 * Every invisible mistake in one authored string.
 *
 * @param profile The course's language profile (`profileFor(TARGET_LANG)`), if any.
 */
export function findTextProblems(text: string, profile?: LanguageProfile): TextProblem[] {
  const normal = text.normalize('NFC');
  const chars = [...normal];
  return [
    ...notNfc(text),
    ...strayMarks(chars),
    ...(normal.match(WORD) ?? []).flatMap(mixedScript),
    ...(profile ? misplacedMarks(chars, profile) : []),
  ];
}

/**
 * Every string value anywhere in a parsed JSON tree, in document order. Keys are not
 * text, and neither is a string directly under one of guard d's `ASSET_KEYS`: a path.
 */
export function collectStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    found.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, found));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const isPath = typeof entry === 'string' && (ASSET_KEYS as readonly string[]).includes(key);
      if (!isPath) collectStrings(entry, found);
    }
  }
  return found;
}

/** One authored string and the file it came from, so a failure needs no searching. */
export interface AuthoredText {
  /** Repo-relative path, forward slashes on every OS. */
  readonly source: string;
  readonly value: string;
}

/** Every authored string in a course: its lessons' JSON and its `course.json`. */
export function authoredStrings(repoRoot: string): AuthoredText[] {
  const courseJson = path.join(repoRoot, 'course.json');
  const files = [...loConfigFiles(repoRoot), ...(existsSync(courseJson) ? [courseJson] : [])];
  return files.flatMap((file) => {
    const source = toPosixPath(path.relative(repoRoot, file));
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
    return collectStrings(parsed).map((value) => ({ source, value }));
  });
}
