/**
 * parsing.ts — shared sentence parser for fill-blank exercises (spec §8, "ported
 * once"). Ported from french-lo-1's exerciseParsing.js, typed.
 *
 * Authored text embeds blanks inside square brackets:
 *   "Yo [soy|*es|eres] aquí."          choice blank — `*` marks the correct option
 *   "Je [mange::type here] du pain."   typed-answer blank — `expected::placeholder`
 *   "Il est [prof|enseignant::métier]." several answers split by `|`, the first preferred
 *
 * `parseSentence` walks the string once and yields an ordered segment list:
 *   - text segments  → { key, type: 'text', value }   (HTML entities decoded)
 *   - blank segments → whatever the injected `parseBlank` returns
 * It owns the parts every engine shares (regex walk, slicing, entity decoding,
 * tail handling, blank-index bookkeeping); each engine supplies only `parseBlank`.
 *
 * `choiceBlankProblems` and `inputBlankProblems` are the content checks the engine
 * schemas run at load (TODO §E34). They read a sentence through this same parser, and
 * judge each option and answer decoded and normalized as the page shows and grades it
 * (TODO §E35), so what the build accepts is exactly what the engine can render and grade.
 * `inputBlankRepeatProblems` is the one the inline-gap envelope runs, since it needs
 * `options.caseSensitive` (§E54).
 *
 * Spec: docs/specs/2026-06-19-exercise-engines-design.md §8.
 */
import { emptyAlternativeProblems, repeatedAlternativeProblems } from './answer-checks';
import { normalizeAnswer } from './answers';
import { splitAlternatives } from './answer-alternatives';
import { decodeHtmlEntities } from './html';

/** A run of literal text between blanks (entities already decoded). */
export interface TextSegment {
  key: string;
  type: 'text';
  value: string;
}

/** What a blank handler returns: the metadata to record + the segment to render. */
export interface BlankParseResult<TMeta, TSegment> {
  meta: TMeta;
  segment: TSegment;
}

export interface ParseSentenceOptions<TMeta, TSegment> {
  /** First blank index — lets a caller continue numbering across sentences. */
  startBlankIndex?: number;
  /**
   * Optional accumulator the parser writes each blank's metadata into, at its
   * blankIndex. Provided and mutated in place by design: the engine collects
   * winner/options metadata during its render walk (not an immutable input).
   */
  blanksMeta?: TMeta[];
  /** Per-blank handler: turns the raw inner text into metadata + a segment. */
  parseBlank: (rawInner: string, blankIndex: number) => BlankParseResult<TMeta, TSegment>;
}

export interface ParseSentenceResult<TSegment> {
  segments: Array<TextSegment | TSegment>;
  nextBlankIndex: number;
}

const BLANK_REGEX = /\[([^\]]+)\]/g;

export function parseSentence<TMeta, TSegment>(
  text: string,
  { startBlankIndex = 0, blanksMeta, parseBlank }: ParseSentenceOptions<TMeta, TSegment>,
): ParseSentenceResult<TSegment> {
  const segments: Array<TextSegment | TSegment> = [];
  // Fresh regex state per call (BLANK_REGEX is global/stateful via lastIndex).
  const regex = new RegExp(BLANK_REGEX.source, 'g');
  let blankIndex = startBlankIndex;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        key: `text-${blankIndex}-${lastIndex}`,
        type: 'text',
        value: decodeHtmlEntities(text.slice(lastIndex, match.index)),
      });
    }

    const { meta, segment } = parseBlank(match[1], blankIndex);
    if (blanksMeta) blanksMeta[blankIndex] = meta;
    segments.push(segment);

    blankIndex += 1;
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      key: `tail-${blankIndex}-${lastIndex}`,
      type: 'text',
      value: decodeHtmlEntities(text.slice(lastIndex)),
    });
  }

  return { segments, nextBlankIndex: blankIndex };
}

/** Metadata for a multiple-choice blank: the option labels + index of the winner. */
export interface ChoiceMeta {
  options: string[];
  winner: number;
}

/** Render segment for a choice blank (the engine maps blankIndex → its <Select>). */
export interface ChoiceSegment {
  blankIndex: number;
  key: string;
  type: 'choice';
}

/** One option of a choice blank: as written, as shown, and whether `*` marks it correct. */
interface ChoiceOption {
  /** Trimmed, its `*` dropped, entities not yet decoded: what the author typed. */
  written: string;
  /** `written` with entities decoded: what the learner sees. */
  label: string;
  marked: boolean;
}

/** Splits a choice blank's inner text into its options: the one split the engine and
 *  the content check both use. The `|` and `*` syntax is read before any entity is
 *  decoded, so `&#124;` or `&#42;` in an option is text, never a split or a mark. */
function splitChoiceOptions(rawInner: string): ChoiceOption[] {
  return rawInner.split('|').map((raw) => {
    const option = raw.trim();
    const marked = option.startsWith('*');
    const written = marked ? option.substring(1).trim() : option;
    return { written, label: decodeHtmlEntities(written), marked };
  });
}

/**
 * Blank handler for multiple-choice blanks: `[suis|*es|est]`. The `*`-prefixed
 * option is the winner; options are trimmed and entity-decoded. `winner` is -1
 * when no option is marked, an authoring error `choiceBlankProblems` refuses at load.
 */
export function parseChoiceBlank(
  rawInner: string,
  blankIndex: number,
): BlankParseResult<ChoiceMeta, ChoiceSegment> {
  const choiceOptions = splitChoiceOptions(rawInner);

  return {
    meta: {
      options: choiceOptions.map((option) => option.label),
      winner: choiceOptions.findIndex((option) => option.marked),
    },
    segment: { blankIndex, key: `choice-${blankIndex}`, type: 'choice' },
  };
}

/** Metadata for a typed-answer blank: the answers it accepts, an optional hint, a width. */
export interface InputMeta {
  /** The preferred answer, decoded: `accepted[0]`. Show answers fills it in. */
  expected: string;
  /** Every answer the blank accepts, decoded, in authored order (TODO §E54). */
  accepted: string[];
  placeholder: string;
  /** Suggested input width in `ch`: the longest answer, floored at 6, plus 2 padding. */
  widthCh: number;
}

/** Render segment for a typed-answer blank (the engine maps blankIndex → its input). */
export interface InputSegment {
  blankIndex: number;
  key: string;
  type: 'input';
}

/** Splits a typed blank's inner text on `::` into its answer and hint, as written:
 *  trimmed, entities not yet decoded. The one split the engine and the content check use. */
function splitInputBlank(rawInner: string): { answer: string; hint: string } {
  const [answer = '', hint = ''] = rawInner.trim().split('::');
  return { answer: answer.trim(), hint: hint.trim() };
}

/**
 * Blank handler for typed-answer blanks: `[expected::placeholder]`. The token is split
 * on `::` into the answer and an optional placeholder hint; the answer is split on `|`
 * into the answers the blank accepts (TODO §E54), and only then is each entity-decoded
 * and trimmed, so `&#124;` is a `|` the learner types. `expected` is the first, preferred
 * answer. `widthCh` sizes the input to the LONGEST answer (min 6 chars), so the width
 * does not give the preferred one away.
 */
export function parseInputBlank(
  rawInner: string,
  blankIndex: number,
): BlankParseResult<InputMeta, InputSegment> {
  const { answer, hint } = splitInputBlank(rawInner);
  const accepted = splitAlternatives(answer).map((written) => decodeHtmlEntities(written).trim());
  const placeholder = decodeHtmlEntities(hint).trim();
  const longest = Math.max(...accepted.map((alternative) => alternative.length));

  return {
    meta: { expected: accepted[0], accepted, placeholder, widthCh: Math.max(longest, 6) + 2 },
    segment: { blankIndex, key: `input-${blankIndex}`, type: 'input' },
  };
}

/* ---------- Content checks, run at load by the engine schemas ---------- */

const STRAY_BRACKETS =
  'the sentence has brackets that do not pair up: each blank is one [ … ], with no [ or ] inside it';

/** True when a `[` or `]` is not part of a blank the parser reads, or a blank holds a `[`. */
function hasStrayBrackets(text: string): boolean {
  const blankRegex = new RegExp(BLANK_REGEX.source, 'g');
  if ([...text.matchAll(blankRegex)].some(([, inner]) => inner.includes('['))) return true;
  return /[[\]]/.test(text.replace(blankRegex, ''));
}

/** How many blanks the parser finds in `text` (of any kind). */
export function countBlanks(text: string): number {
  return parseSentence(text, { parseBlank: parseInputBlank }).nextBlankIndex;
}

/** The faults in one choice blank's options, judged as the learner sees them. */
function choiceOptionProblems(blank: string, choiceOptions: ChoiceOption[]): string[] {
  const problems: string[] = [];
  // Compared as grading compares typed answers: spacing, Unicode form and apostrophe
  // variants fold; capitals and accents stay, since `Es` and `és` are real choices.
  const shown = choiceOptions.map((option) => normalizeAnswer(option.label));
  const blankAt = choiceOptions.findIndex((_, i) => shown[i] === '');
  if (choiceOptions.some((option, i) => option.marked && shown[i] === '')) {
    problems.push(`the blank ${blank} marks an empty option correct: write the option after the *`);
  } else if (blankAt !== -1) {
    const { written } = choiceOptions[blankAt];
    problems.push(
      written === ''
        ? `the blank ${blank} has an empty option: remove the extra |`
        : `the blank ${blank} has an option, "${written}", that shows as nothing: write the option or remove it`,
    );
  }
  const repeatAt = shown.findIndex((option, i) => option !== '' && shown.indexOf(option) !== i);
  if (repeatAt !== -1) {
    const first = choiceOptions[shown.indexOf(shown[repeatAt])].written;
    const again = choiceOptions[repeatAt].written;
    const spelling = first === again ? '' : ` (written "${first}" and "${again}")`;
    problems.push(
      `the blank ${blank} offers "${shown[repeatAt]}" twice${spelling}: each option must differ`,
    );
  }
  return problems;
}

/**
 * What stops a learner answering the `[a|*b|c]` blanks in `text`, one plain sentence per
 * fault; empty when every blank is usable. A blank needs exactly one `*`, no option that
 * shows as nothing and no two options that look the same. The `*` is read as written;
 * the options are judged decoded, by the decoder the page uses, so an option written
 * `&eacute;` beside `é` is the same option twice (TODO §E35).
 */
export function choiceBlankProblems(text: string): string[] {
  const problems: string[] = hasStrayBrackets(text) ? [STRAY_BRACKETS] : [];
  parseSentence(text, {
    parseBlank: (rawInner, blankIndex) => {
      const blank = `[${rawInner}]`;
      const choiceOptions = splitChoiceOptions(rawInner);
      const marked = choiceOptions.filter((option) => option.marked).length;
      if (marked === 0) {
        problems.push(
          `the blank ${blank} has no correct option: put * before the right one, as in [*right|wrong]`,
        );
      } else if (marked > 1) {
        problems.push(`the blank ${blank} marks ${marked} options correct: keep * on one only`);
      }
      problems.push(...choiceOptionProblems(blank, choiceOptions));
      return parseChoiceBlank(rawInner, blankIndex);
    },
  });
  return problems;
}

/**
 * What stops a learner answering the `[expected::placeholder]` blanks in `text`, one
 * plain sentence per fault; empty when every blank has an answer a learner would type.
 * The answers are judged as the engine grades them: split on `|`, decoded by
 * `parseInputBlank`, then normalized as typed answers are, so `[&nbsp;]` has no answer
 * and `[a|&nbsp;]` has an empty one (TODO §E35, §E54). A pasted choice blank is caught
 * by its `*`, looked for as written. An answer accepted twice is
 * `inputBlankRepeatProblems`, run by the envelope schema, which knows `caseSensitive`.
 */
export function inputBlankProblems(text: string): string[] {
  const problems: string[] = hasStrayBrackets(text) ? [STRAY_BRACKETS] : [];
  parseSentence(text, {
    parseBlank: (rawInner, blankIndex) => {
      const blank = `the blank [${rawInner}]`;
      const parsed = parseInputBlank(rawInner, blankIndex);
      const { accepted } = parsed.meta;
      const written = splitAlternatives(splitInputBlank(rawInner).answer);
      if (accepted.every((answer) => normalizeAnswer(answer) === '')) {
        problems.push(`${blank} has no answer: write it before any ::, as in [llamo::llamarse]`);
      } else if (written.some((answer) => answer.startsWith('*'))) {
        problems.push(
          `${blank} is written as a choice: here a blank is [answer::hint], and the learner types the answer`,
        );
      } else {
        problems.push(...emptyAlternativeProblems(accepted).map((end) => `${blank} ${end}`));
      }
      return parsed;
    },
  });
  return problems;
}

/**
 * The `[a|b]` typed blanks in `text` that accept one answer twice, judged decoded and
 * compared as grading compares them: capitals folded unless `caseSensitive` (TODO §E54).
 */
export function inputBlankRepeatProblems(text: string, caseSensitive: boolean): string[] {
  const problems: string[] = [];
  parseSentence(text, {
    parseBlank: (rawInner, blankIndex) => {
      const parsed = parseInputBlank(rawInner, blankIndex);
      const repeats = repeatedAlternativeProblems(
        parsed.meta.accepted,
        normalizeAnswer,
        caseSensitive,
      );
      problems.push(...repeats.map((end) => `the blank [${rawInner}] ${end}`));
      return parsed;
    },
  });
  return problems;
}
