/**
 * answer-checks.ts — the shared checks for answers that sit in their own JSON field
 * rather than inside a `[…]` blank (TODO §E42). The blank syntax has its own checks in
 * `parsing.ts` (E34, E35); these are the same two questions asked of a plain field:
 * does it show as anything, and can a learner tell it from its neighbours?
 *
 * JUDGED AS WRITTEN. A field in its own JSON property reaches the page as React text, so
 * an entity such as `&eacute;` shows literally and is never decoded here. Two labels are
 * the same when they normalize the same way typed answers are graded (`normalizeAnswer`):
 * spacing, Unicode form and apostrophe shape fold; capitals and accents stay, so `Sí` and
 * `si` are real choices, as they are for `[a|*b]` blanks.
 *
 * TYPED ANSWERS WITH MORE THAN ONE FORM (TODO §E54). `|` splits a typed answer into the
 * forms it accepts (answer-alternatives.ts). None may be empty, and no two may grade the
 * same: compared with the engine's own normalizing, capitals folded unless the exercise
 * is `caseSensitive`, as `answerKey` (answer-feedback.ts) compares them. These checks
 * return the END of a sentence; the schema names the row or blank that starts it.
 *
 * Each check returns plain sentences for a course author, numbering from 1, so the build
 * error reads "question 2 offers …", beside the file and field path Zod already names.
 */
import { splitAlternatives } from './answer-alternatives';
import { normalizeAnswer } from './answers';

/** One option a learner chooses between, and whether the author marked it correct. */
export interface ChoiceLabel {
  readonly label: string;
  readonly marked: boolean;
}

/** Index of the first label that shows as nothing, or -1. */
function firstEmpty(shown: readonly string[]): number {
  return shown.findIndex((label) => label === '');
}

/** `[first, again]`: the first label that repeats an earlier one, or undefined. */
function firstRepeat(shown: readonly string[]): readonly [number, number] | undefined {
  const again = shown.findIndex((label, i) => label !== '' && shown.indexOf(label) !== i);
  return again === -1 ? undefined : [shown.indexOf(shown[again]), again];
}

/**
 * The faults in one question's options: an empty correct option, an option that shows
 * as nothing, two options that look the same. `question` names it, as "question 2".
 */
export function choiceLabelProblems(question: string, options: readonly ChoiceLabel[]): string[] {
  const shown = options.map((option) => normalizeAnswer(option.label));
  const problems: string[] = [];
  if (options.some((option, i) => option.marked && shown[i] === '')) {
    problems.push(`${question} marks an empty option correct: write the option after the *`);
  } else if (firstEmpty(shown) !== -1) {
    problems.push(`${question} has an option that shows as nothing: write the option or remove it`);
  }
  const repeat = firstRepeat(shown);
  if (repeat) {
    problems.push(
      `${question} offers "${shown[repeat[1]]}" twice: each option must look different`,
    );
  }
  return problems;
}

/**
 * The faults in a list of labels a learner tells apart, one per item (a word to match,
 * a card): one that shows as nothing, and one that looks like an earlier one. `noun`
 * names an entry, as "item".
 */
export function distinctLabelProblems(noun: string, labels: readonly string[]): string[] {
  const shown = labels.map(normalizeAnswer);
  return [...blankLabelProblems(noun, labels), ...repeatProblems(noun, shown)];
}

/** One sentence per label that shows as nothing, naming it, as "word 2". */
export function blankLabelProblems(noun: string, labels: readonly string[]): string[] {
  return labels.flatMap((label, i) =>
    normalizeAnswer(label) === ''
      ? [`${noun} ${i + 1} shows as nothing: write it or remove the ${noun}`]
      : [],
  );
}

function repeatProblems(noun: string, shown: readonly string[]): string[] {
  const repeat = firstRepeat(shown);
  if (!repeat) return [];
  const [first, again] = repeat;
  return [
    `${noun} ${again + 1} shows "${shown[again]}", as ${noun} ${first + 1} does: a learner could not tell them apart`,
  ];
}

/** True when `labels` hold at least two that look different, so an order can be found. */
export function hasTwoDifferent(labels: readonly string[]): boolean {
  return new Set(labels.map(normalizeAnswer)).size >= 2;
}

/**
 * Whether a typed answer gives the learner something to type once the engine's own
 * grading has normalized it (`normalizeAnswer`, or `normalizeForDictation`).
 */
export function hasTypedAnswer(answer: string, normalize: (text: string) => string): boolean {
  return normalize(answer) !== '';
}

/** How an engine normalizes a typed answer before grading it. */
export type NormalizeAnswer = (text: string) => string;

/**
 * An answer with two or more alternatives where one is empty (`a||b`, `a|`). A lone
 * empty answer is the schema's own "has no answer", so it is not reported here.
 */
export function emptyAlternativeProblems(alternatives: readonly string[]): string[] {
  const hasEmpty = alternatives.some((alternative) => normalizeAnswer(alternative) === '');
  return alternatives.length > 1 && hasEmpty ? ['has an empty answer: remove the extra |'] : [];
}

/**
 * The first alternative that grades the same as an earlier one: `normalize`d, capitals
 * folded unless `caseSensitive`. Named as the engine shows it, normalized.
 */
export function repeatedAlternativeProblems(
  alternatives: readonly string[],
  normalize: NormalizeAnswer,
  caseSensitive: boolean,
): string[] {
  const keys = alternatives.map((alternative) => {
    const normalized = normalize(alternative);
    return caseSensitive ? normalized : normalized.toLowerCase();
  });
  const again = keys.findIndex((key, index) => key !== '' && keys.indexOf(key) !== index);
  if (again === -1) return [];
  return [`accepts "${normalize(alternatives[again])}" twice: each answer must differ`];
}

/**
 * The faults in a typed answer written in its own field (typed-transform, dictation,
 * conjugation), judged as written: an empty alternative, and one accepted twice.
 */
export function typedAnswerProblems(
  answer: string,
  normalize: NormalizeAnswer,
  caseSensitive = false,
): string[] {
  const alternatives = splitAlternatives(answer);
  return [
    ...emptyAlternativeProblems(alternatives),
    ...repeatedAlternativeProblems(alternatives, normalize, caseSensitive),
  ];
}
