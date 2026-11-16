/**
 * ui-strings.ts — UI-chrome strings, two-layer (spec §9, decision #13).
 *
 * WHAT: the words the exercise chrome shows ("Check", "Next", "Correct!", audio
 * controls). They must NOT be hardcoded in components — components read these keys.
 *
 * TWO LAYERS:
 *   Layer 1 — global `uiStrings` (this file). Flat key→string map, the course-wide
 *     default. Zod: ALL keys required → build fails on any missing key, so no
 *     half-translated chrome can ship.
 *   Layer 2 — per-exercise `labels` override, lives in the LO JSON (validated later
 *     with `UiStringsOverrideSchema`). Optional + partial: one exercise can say
 *     "See answer" while the rest fall back to the global "Show answers". Keys must be
 *     real and values strings — a typo like `chekc` fails the build.
 *
 * RESOLUTION: `resolveLabel(key, overrides)` → override wins, global always exists.
 *
 * NOT a runtime i18n framework — each clone is one language, set once. The chrome is
 * English by default (UI language ≠ the course's content language). Seed values are
 * grounded in french-lo-1's real strings.
 *
 * Spec: docs/specs/2026-06-15-lc-base-template-design.md §9, decision #13.
 */
import { z } from 'zod';

/**
 * A label that names values through `{placeholders}`, each of which must survive a
 * rewording (E63): "Hide it" for "Hide {language}" would name no language.
 */
function labelWith(...placeholders: readonly string[]) {
  const tokens = placeholders.map((name) => `{${name}}`);
  return z
    .string()
    .min(1)
    .refine((value) => tokens.every((token) => value.includes(token)), {
      message: `must contain ${tokens.join(' and ')}`,
    });
}

/**
 * The key set. `strictObject` → an unrecognized key (typo) is an error, not silently
 * stripped, on BOTH the global map and the per-exercise override.
 */
export const UiStringsSchema = z.strictObject({
  // Exercise chrome
  check: z.string().min(1),
  next: z.string().min(1),
  previous: z.string().min(1),
  reset: z.string().min(1),
  continue: z.string().min(1),
  showAnswer: z.string().min(1),
  hideAnswer: z.string().min(1),
  correct: z.string().min(1),
  incorrect: z.string().min(1),
  showHints: z.string().min(1),
  // The progress line under an exercise (ProgressMeter): a template that must name both
  // counts, or a rewording could show a count with no number.
  progressCorrect: z
    .string()
    .min(1)
    .refine((value) => value.includes('{correct}') && value.includes('{total}'), {
      message: 'must contain both {correct} and {total}',
    }),
  // Feedback under a wrong typed answer (AnswerFeedback, TODO §D15): a hint naming the
  // kind of error on the first wrong Check, the answer on the second.
  hintAccent: z.string().min(1),
  hintEnding: z.string().min(1),
  hintMissing: z.string().min(1),
  hintClose: z.string().min(1),
  hintFar: z.string().min(1),
  answerLabel: z.string().min(1),
  answerKey: z.string().min(1),
  // The other accepted answers under a revealed one (TODO §E54): "Also accepted: a · b".
  alsoAccepted: z.string().min(1),
  // Accessible names for controls with no readable text of their own
  blank: z.string().min(1),
  // Audio controls (listening / dictation exercises)
  play: z.string().min(1),
  pause: z.string().min(1),
  listen: z.string().min(1),
  audioVolume: z.string().min(1),
  audioProgress: z.string().min(1),
  // Screen-reader note after a link that opens in a new tab (rich-text links)
  opensInNewTab: z.string().min(1),
  // Screen-reader label before each citation in a sources block (the icon says it visually)
  sourcePrint: z.string().min(1),
  sourceWeb: z.string().min(1),
  // Media transcript toggle (tab media, spec 2026-10-07-tabs-media-design §4)
  showTranscript: z.string().min(1),
  hideTranscript: z.string().min(1),
  // The footer's Credits button (spec 2026-11-11-footer-credits-design §5)
  credits: z.string().min(1),
  // The vocabulary block (E63, spec 2026-11-12-vocabulary-word-bank-design §4–5): its two
  // views, and the self-test that hides one side. {language} is a language's English
  // name (`languageName`, src/lib/lang.ts); {number} is the word's place in the view.
  vocabularyViews: z.string().min(1),
  vocabularySemantic: z.string().min(1),
  vocabularyAlphabetical: z.string().min(1),
  vocabularySelfTest: z.string().min(1),
  vocabularyHide: labelWith('language'),
  vocabularyReveal: z.string().min(1),
  vocabularyRevealWord: labelWith('language', 'number'),
  vocabularyListen: labelWith('term'),
  vocabularyListenWord: labelWith('number'),
});

/** Full required map (Layer 1). */
export type UiStrings = z.infer<typeof UiStringsSchema>;
/** Every valid chrome key. */
export type UiStringKey = keyof UiStrings;

/**
 * Layer 2 schema: partial (any subset) but still strict (typo keys rejected).
 * The LO JSON's optional `labels` block is validated against this.
 */
export const UiStringsOverrideSchema = UiStringsSchema.partial();
export type UiStringsOverride = z.infer<typeof UiStringsOverrideSchema>;

/** Out-of-box English chrome. */
const raw: UiStrings = {
  check: 'Check',
  next: 'Next',
  previous: 'Previous',
  reset: 'Reset',
  continue: 'Continue',
  showAnswer: 'Show answers',
  hideAnswer: 'Hide answer',
  correct: 'Correct!',
  incorrect: 'Incorrect',
  showHints: 'Show hints',
  progressCorrect: '{correct} correct out of {total}',
  hintAccent: 'Almost. Check the accents.',
  hintEnding: 'Close. Look at the ending.',
  hintMissing: 'Close. Something is missing.',
  hintClose: 'Close. Check the spelling.',
  hintFar: 'Not quite. Try again.',
  answerLabel: 'Answer:',
  answerKey: 'Highlighted: what differs from yours',
  alsoAccepted: 'Also accepted:',
  blank: 'Blank',
  play: 'Play',
  pause: 'Pause',
  listen: 'Listen',
  audioVolume: 'Audio volume',
  audioProgress: 'Audio progress',
  opensInNewTab: '(opens in a new tab)',
  sourcePrint: 'Print source:',
  sourceWeb: 'Web source:',
  showTranscript: 'Show transcript',
  hideTranscript: 'Hide transcript',
  credits: 'Credits',
  vocabularyViews: 'Choose a view',
  vocabularySemantic: 'Semantic',
  vocabularyAlphabetical: 'Alphabetical',
  vocabularySelfTest: 'Test yourself',
  vocabularyHide: 'Hide {language}',
  vocabularyReveal: 'Reveal',
  vocabularyRevealWord: 'Reveal {language}, word {number}',
  vocabularyListen: 'Listen: {term}',
  vocabularyListenWord: 'Listen: word {number}',
};

/** Validate at load. A missing/blank/typo key throws here → build dies immediately. */
export const uiStrings: UiStrings = UiStringsSchema.parse(raw);

/**
 * Resolve a chrome label: per-exercise override wins, global default always exists.
 * @example resolveLabel('check', config.labels) // "See answer" if overridden, else "Check"
 */
export function resolveLabel(key: UiStringKey, overrides?: UiStringsOverride): string {
  return overrides?.[key] ?? uiStrings[key];
}

/**
 * Fills each `{name}` in a label with its value (E63); a placeholder with no value is
 * left as written.
 * @example fillLabel(resolveLabel('vocabularyHide'), { language: 'Russian' }) // "Hide Russian"
 */
export function fillLabel(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, () => String(value)),
    template,
  );
}
