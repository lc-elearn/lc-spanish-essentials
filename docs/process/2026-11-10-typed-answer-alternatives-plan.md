# Typed answer alternatives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `|` means "or" in every typed answer (inline-gap, typed-transform, dictation, conjugation): any alternative grades right, the first is preferred and filled by Show answers, a wrong answer is hinted at and revealed against the closest alternative with the others listed under "Also accepted:", and the build refuses an empty alternative or one accepted twice.

**Architecture:** One pure splitter, `splitAlternatives()` in `src/exercises/lib/answer-alternatives.ts`, is the only code that splits a typed answer on `|`. Grading stays in `gradeTypedAnswers()` (`answer-feedback.ts`), which now takes one list of accepted answers per gap or row; the three engine wrappers pass the lists. Load checks are shared sentence-ends in `answer-checks.ts` (`emptyAlternativeProblems`, `repeatedAlternativeProblems`, `typedAnswerProblems`); `parsing.ts` uses them for inline-gap blanks, judged decoded. Because only the exercise **envelope** schema sees `options.caseSensitive`, the "accepted twice" check runs as a `superRefine` on each of the four `*ExerciseConfigSchema`s (see "Decisions this plan makes"). The view change is one extra line in `<AnswerFeedback>`, worded by a new UI string `alsoAccepted`.

**Tech Stack:** TypeScript, Zod 4.4.3, React 19 (static-markup tests), Vitest (`bun run test`, never `bun test`), Playwright + axe (`e2e/debug/`, `DEBUG=1` build). Spec: [`docs/specs/2026-11-10-typed-answer-alternatives-design.md`](../specs/2026-11-10-typed-answer-alternatives-design.md).

**Ground rules (AGENTS.md):** `bun run test <path>`, never `bun test`. Tests sit beside the code as `<name>.test.ts(x)` under `src/`. Each task starts from a failing test. Vitest does not type-check: run `bunx tsc -b` after each task that changes a type (it is part of `bun run build`). One concern per commit, Conventional Commits. Re-read a markdown doc immediately before editing it, and run `bun run format` before committing a doc (Prettier reflows tables). Do not weaken a guard. Read `docs/process/TODO.md` before starting.

---

## Facts the code relies on (checked 2026-11-10)

- `gradeTypedAnswers(expected: readonly string[], values, previousMisses, mode, caseSensitive)`
  in `src/exercises/lib/answer-feedback.ts` grades every typed engine. Its wrappers:
  `gradeInlineGap` / `fillInlineGapAnswers` (`inline-gap-grading.ts`), `gradeTextEntry` /
  `fillAnswers` (`text-entry-grading.ts`, typed-transform and dictation) and
  `gradeConjugation` / `fillConjugationAnswers` (`conjugation-grading.ts`). Show answers
  is the `fill*` function in each; the views only dispatch its result.
- `answerKey(value, mode, caseSensitive)` is what grading compares; `similarity(a, b)` is
  `2·LCS / (|a|+|b|)`; `feedbackFor(typed, expected, misses, mode, caseSensitive)` builds
  the hint or reveal. `{ kind: 'reveal' }` literals exist only in
  `answer-feedback.test.ts` and `AnswerFeedback.test.tsx` (the `WordSpotExercise` one is
  an unrelated reducer action).
- `parseInputBlank` (`parsing.ts`) returns `InputMeta { expected, placeholder, widthCh }`.
  `InputMeta` is used by `InlineTypedGapExercise.tsx` (`meta.placeholder`, `meta.widthCh`)
  and `inline-gap-grading.ts` (`meta.expected`) only. `splitInputBlank` splits on `::`
  before any entity is decoded.
- `inputBlankProblems` today refuses any `|` or a leading `*` as "is written as a choice".
  No LO under `lo-config/` uses inline-gap, typed-transform, dictation or conjugation, and
  no fixture answer contains `|`, so nothing authored changes meaning.
- `options` (with `caseSensitive`, default `false`) lives on `ExerciseConfigSchema`
  (`src/config/lo-schema.ts`), **beside** `content`. The content schemas
  (`InlineGapContentSchema`, `TextEntryContentSchema`, `DictationContentSchema`,
  `ConjugationContentSchema`) cannot see it. The loader and every view parse the envelope
  (`exerciseConfigSchema(type)` in `src/exercises/exercise-schemas.ts`;
  `XExerciseConfigSchema.safeParse(config)` in each view). Nothing calls `.extend` on an
  engine envelope, so a `.superRefine` on it is safe.
- Zod 4.4.3, checked in a scratch script: an object-level `.superRefine` on the envelope
  **still runs** when `content` has non-aborting issues (a `.min(1)` or a custom issue),
  and does **not** run after a type error (a number where a string belongs). So an author
  may see a content fault and a repeat in one build error, never a crash.
- The E42 matrix test `src/exercises/answer-validation.test.ts` parses through
  `exerciseConfigSchema(type)` (the envelope) and already holds the table engines' "has
  no answer" and "has nothing to type" tests; existing messages: `row N has no answer:
write what the learner should type` (text-entry), `row N (person) has no answer: write
the verb form` (conjugation), `row N has nothing to type: dictation ignores punctuation
and quotes, so the answer needs words` (dictation).
- Every showcase fixture is parsed through its envelope schema by
  `src/exercises/exercise-schemas.test.ts` ("accepts the %s showcase fixture").
- UI strings: `UiStringsSchema` (strict, every key required) and `raw` in
  `src/config/ui-strings.ts`; `resolveLabel(key, labels)`.
- Showcase (`DEBUG=1` only): each fixture renders as `article#<fixture id>`; helpers
  `openShowcase`, `card` in `e2e/debug/debug-support.ts`; `expectNoAxeViolations(page,
scope)` in `e2e/support.ts`. Inline-gap inputs are labelled `Answer for blank N` (1-based,
  numbered across the card); the progress line is `role="status"`, "{correct} correct out
  of {total}". The `inline-gap` card has 5 blanks today (llamo, soy, vivimos, tiene,
  estudia), so a sentence appended to it holds blank 6 of 6.
- Coverage bars (`vite.config.ts`): 80% lines per `.ts` logic file, 20% per `.tsx`;
  fixtures excluded.

## Decisions this plan makes (flag to the maintainer in the PR)

1. **"Twice" is checked on the envelope, not the content schema.** It is the only schema
   that sees `options.caseSensitive` (spec §5: "judged case-folded unless the exercise is
   `caseSensitive`"). The case-independent checks (empty alternative, a `*`, dictation's
   punctuation-only alternative) stay with the existing content-level checks. Consequence:
   `InlineGapContentSchema` / `TextEntryContentSchema` parsed alone do not report repeats;
   the build, the views and the fixture test all parse the envelope, so nothing an author
   meets changes. Repeat issues carry the path `content.items[i].text` /
   `content.rows[i].answer`.
2. **`InputMeta` keeps `expected` (now the preferred, first answer) and gains
   `accepted: string[]`** (every answer, decoded, in authored order, `accepted[0] ===
expected`). Show answers in inline-gap therefore needs no code change.
3. **The reveal's `answer` is the closest alternative; `alsoAccepted` is every other
   alternative**, in authored order (so the preferred answer is listed under "Also
   accepted:" when the closest is another one).
4. **An inline-gap blank of only `|` (`[|]`) is "has no answer"**, not "has an empty
   answer": every alternative is empty. A table `answer` of `"|"` is "has an empty
   answer" (the existing "no answer" check only sees the whole string).
5. **The table engines' new load-check tests go in the E42 matrix**,
   `src/exercises/answer-validation.test.ts`, beside their existing "has no answer"
   tests, rather than in each engine's schema test (spec §8 says "each engine's schema
   test"); inline-gap's go in `inline-gap-schema.test.ts`.
6. **Repeats are named as written.** The "accepts … twice" message quotes the later,
   repeated alternative after the engine's normalizing, capitals kept (`[soy|Soy]` →
   `accepts "Soy" twice`). Task 5's plan text expected "soy"; its test now expects "Soy"
   (decided while implementing, commit `bb33721`).
7. **Show answers in typed-transform and dictation fills the first alternative
   trimmed** (`splitAlternatives` trims), so a table answer with surrounding spaces is no
   longer filled byte-for-byte; the test name says so (commit `f338724`).

## File structure

| File                                                                                               | Responsibility                                                                      |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/exercises/lib/answer-alternatives.ts` (new)                                                   | `splitAlternatives()`: the one split of a typed answer on `\|`                      |
| `src/exercises/lib/answer-alternatives.test.ts` (new)                                              | its tests                                                                           |
| `src/exercises/lib/parsing.ts`                                                                     | `InputMeta.accepted`, `widthCh` from the longest; blank load checks per alternative |
| `src/exercises/lib/parsing.test.ts`                                                                | parse and load-check tests for alternatives                                         |
| `src/exercises/lib/answer-feedback.ts`                                                             | grade against any alternative; closest for hint/diff; `alsoAccepted` on reveal      |
| `src/exercises/lib/answer-feedback.test.ts`                                                        | grading tests                                                                       |
| `src/exercises/lib/answer-checks.ts`                                                               | empty / repeat sentence-ends; `typedAnswerProblems()`                               |
| `src/exercises/lib/answer-checks.test.ts` (new)                                                    | their tests                                                                         |
| `src/exercises/lib/AnswerFeedback.tsx`                                                             | the "Also accepted:" line                                                           |
| `src/exercises/lib/AnswerFeedback.test.tsx`                                                        | its tests; reveal literals gain `alsoAccepted`                                      |
| `src/config/ui-strings.ts`, `ui-strings.test.ts`                                                   | the `alsoAccepted` string                                                           |
| `src/exercises/inline-gap/inline-gap-grading.ts`                                                   | pass `accepted` lists                                                               |
| `src/exercises/inline-gap/inline-gap-grading.test.ts`                                              | any alternative passes; Show answers fills the first                                |
| `src/exercises/inline-gap/inline-gap-schema.ts`                                                    | envelope `superRefine`: repeats, honouring `caseSensitive`                          |
| `src/exercises/inline-gap/inline-gap-schema.test.ts`                                               | its tests                                                                           |
| `src/exercises/inline-gap/inline-gap.fixture.ts`                                                   | one sentence with three answers                                                     |
| `src/exercises/text-entry/text-entry-grading.ts`                                                   | split rows' answers; Show answers fills the first                                   |
| `src/exercises/text-entry/text-entry-grading.test.ts`                                              | its tests                                                                           |
| `src/exercises/typed-transform/typed-transform-schema.ts`                                          | envelope `superRefine` (strict normalizing)                                         |
| `src/exercises/typed-transform/typed-transform.fixture.ts`                                         | one row with three answers                                                          |
| `src/exercises/dictation/dictation-schema.ts`                                                      | punctuation check per alternative; envelope `superRefine` (dictation normalizing)   |
| `src/exercises/dictation/dictation.fixture.ts`                                                     | one row with three answers                                                          |
| `src/exercises/conjugation/conjugation-grading.ts`                                                 | split rows' answers; Show answers fills the first                                   |
| `src/exercises/conjugation/conjugation-grading.test.ts`                                            | its tests                                                                           |
| `src/exercises/conjugation/conjugation-schema.ts`                                                  | envelope `superRefine`                                                              |
| `src/exercises/conjugation/conjugation.fixture.ts`                                                 | one row with three answers                                                          |
| `src/exercises/answer-validation.test.ts`                                                          | E42 matrix: table-engine alternative faults                                         |
| `e2e/debug/typed-answer-alternatives.spec.ts` (new)                                                | browser: a non-preferred answer is right; reveal lists others; axe                  |
| `CONTRIBUTING.md`, `docs/ROADMAP.md`, `docs/process/TODO.md`, `docs/TOOLING.md`, `public/llms.txt` | docs (spec §9)                                                                      |

Every touched source file stays well under 800 lines: `answer-feedback.ts` ~226 → ~265,
`parsing.ts` ~293 → ~335, `answer-validation.test.ts` ~185 → ~240,
`answer-feedback.test.ts` ~170 → ~245. (`docs/process/TODO.md` is already over 3,000
lines; it is a doc, not code, and the 800-line rule does not apply.)

---

### Task 1: `splitAlternatives()`

**Files:**

- Create: `src/exercises/lib/answer-alternatives.ts`
- Create: `src/exercises/lib/answer-alternatives.test.ts`

- [ ] **Step 1: Write the failing test**

`src/exercises/lib/answer-alternatives.test.ts`:

```ts
/**
 * answer-alternatives.test.ts — a typed answer may accept more than one form, split by
 * `|`, the first preferred (TODO §E54). The split is the one place this happens.
 */
import { describe, expect, test } from 'vitest';
import { splitAlternatives } from './answer-alternatives';

describe('splitAlternatives', () => {
  test('one answer is a list of one', () => {
    expect(splitAlternatives('soy')).toEqual(['soy']);
  });

  test('several answers, in authored order', () => {
    expect(splitAlternatives('обеспеченные|состоятельные|богатые')).toEqual([
      'обеспеченные',
      'состоятельные',
      'богатые',
    ]);
  });

  test('trims the spaces around each |, and keeps the spaces inside an answer', () => {
    expect(splitAlternatives(' в семейном кругу | в кругу семьи |в семье')).toEqual([
      'в семейном кругу',
      'в кругу семьи',
      'в семье',
    ]);
  });

  test('keeps an empty part, so the load check can name it', () => {
    expect(splitAlternatives('a||b')).toEqual(['a', '', 'b']);
    expect(splitAlternatives('a|')).toEqual(['a', '']);
    expect(splitAlternatives('a| |b')).toEqual(['a', '', 'b']);
    expect(splitAlternatives('')).toEqual(['']);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bun run test src/exercises/lib/answer-alternatives.test.ts`
Expected: FAIL — `Failed to resolve import "./answer-alternatives"`.

- [ ] **Step 3: Write the module**

`src/exercises/lib/answer-alternatives.ts`:

```ts
/**
 * answer-alternatives.ts — the answers a typed answer accepts (TODO §E54; spec
 * docs/specs/2026-11-10-typed-answer-alternatives-design.md §3).
 *
 * `|` means "or" in every typed answer: `[в семейном кругу|в кругу семьи::hint]` in an
 * inline-gap, `"answer": "обеспеченные|состоятельные"` in typed-transform, dictation and
 * conjugation. Any number of alternatives; the FIRST is the preferred answer (Show answers
 * fills it in). Nothing else in the codebase splits a typed answer on `|`; a choice blank's
 * `|` is a different syntax, read by `splitChoiceOptions` in parsing.ts.
 *
 * An empty part is kept as `''` so the load checks (answer-checks.ts, parsing.ts) can
 * name it; grading never meets one, because the build refuses it.
 */

/** The accepted answers in a typed answer, in authored order: split on `|`, each trimmed. */
export function splitAlternatives(answer: string): string[] {
  return answer.split('|').map((alternative) => alternative.trim());
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bun run test src/exercises/lib/answer-alternatives.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/lib/answer-alternatives.ts src/exercises/lib/answer-alternatives.test.ts
git commit -m "feat: split a typed answer into its alternatives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: an inline-gap blank reads every answer

`InputMeta` gains `accepted`; `expected` becomes the first (preferred) answer; `widthCh`
fits the longest. Each alternative is decoded after the split, so `&#124;` is text. The
old `|` load check still refuses these blanks until Task 5, so no content changes meaning
in between.

**Files:**

- Modify: `src/exercises/lib/parsing.ts` (`InputMeta`, `parseInputBlank`)
- Modify: `src/exercises/lib/parsing.test.ts`
- Modify: `src/exercises/inline-gap/inline-gap-grading.test.ts` (the `meta` helper, for the new required field)

- [ ] **Step 1: Write the failing tests**

In `src/exercises/lib/parsing.test.ts`, inside `describe('parseInputBlank', …)`, after the
`widthCh floors at 6+2` test, add:

```ts
// TODO §E54: `|` means "or" in a typed answer; the first is the preferred one.
test('reads every answer split by |, the preferred first', () => {
  const { meta } = parseInputBlank(
    ' в семейном кругу | в кругу семьи|в семье :: in the family circle',
    0,
  );
  expect(meta.accepted).toEqual(['в семейном кругу', 'в кругу семьи', 'в семье']);
  expect(meta.expected).toBe('в семейном кругу');
  expect(meta.placeholder).toBe('in the family circle');
});

test('one answer is a list of one', () => {
  expect(parseInputBlank('mange::manger', 0).meta.accepted).toEqual(['mange']);
});

test('widthCh fits the longest answer, so the width does not give the preferred one away', () => {
  expect(parseInputBlank('va|anticonstitutionnel', 0).meta.widthCh).toBe(21); // 19+2
});

test('decodes each answer after the split: &#124; is text, never an "or"', () => {
  expect(parseInputBlank('a&#124;b|caf&eacute;', 0).meta.accepted).toEqual(['a|b', 'café']);
});
```

In the same file, the `feeds parseSentence to produce input segments` test's last line
becomes:

```ts
expect(blanksMeta[0]).toEqual({
  expected: 'mange',
  accepted: ['mange'],
  placeholder: 'indice',
  widthCh: 8,
});
```

- [ ] **Step 2: Run them, expect FAIL**

Run: `bun run test src/exercises/lib/parsing.test.ts`
Expected: FAIL — `meta.accepted` is `undefined` (4 new tests and the updated `toEqual`);
`widthCh` is `24` (the whole `va|anticonstitutionnel` + 2) instead of `21`.

- [ ] **Step 3: Implement**

In `src/exercises/lib/parsing.ts`, add the import beside the others:

```ts
import { splitAlternatives } from './answer-alternatives';
```

Replace the `InputMeta` interface:

```ts
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
```

Replace `parseInputBlank` (doc comment included):

```ts
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
```

(`splitAlternatives` always returns at least one element, so `accepted[0]` is a string.)

Update the file header's example line `"Je [mange::type here] du pain."   typed-answer blank —
\`expected::placeholder\``to add, on the next line:`"Il est [prof|enseignant::métier]." several answers split by \`|\`, the first preferred`.

In `src/exercises/inline-gap/inline-gap-grading.test.ts`, the helper becomes:

```ts
const meta = (expected: string): InputMeta => ({
  expected,
  accepted: [expected],
  placeholder: '',
  widthCh: 8,
});
```

- [ ] **Step 4: Run, expect PASS**

Run: `bun run test src/exercises/lib/parsing.test.ts src/exercises/inline-gap && bunx tsc -b`
Expected: PASS; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/lib/parsing.ts src/exercises/lib/parsing.test.ts src/exercises/inline-gap/inline-gap-grading.test.ts
git commit -m "feat: read every answer in an inline-gap blank

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: grade against any alternative; reveal lists the others

**Files:**

- Modify: `src/exercises/lib/answer-feedback.ts`
- Modify: `src/exercises/lib/answer-feedback.test.ts`
- Modify: `src/exercises/lib/AnswerFeedback.test.tsx` (reveal literals gain `alsoAccepted: []`, for the type)
- Modify: `src/exercises/inline-gap/inline-gap-grading.ts`, `inline-gap-grading.test.ts`
- Modify: `src/exercises/text-entry/text-entry-grading.ts`, `text-entry-grading.test.ts`
- Modify: `src/exercises/conjugation/conjugation-grading.ts`, `conjugation-grading.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/exercises/lib/answer-feedback.test.ts`:

1. Add `closestAlternative` to the import list from `./answer-feedback`.
2. In `describe('feedbackFor', …)`, both `toEqual({ kind: 'reveal', … })` objects gain a
   last property `alsoAccepted: [],`.
3. In `describe('firstMarkedReveal', …)`, both `plain` and `marked` literals gain
   `alsoAccepted: [],` after `segments`.
4. In `describe('gradeTypedAnswers — one Check over a set of typed answers', …)`, replace
   `const expected = ['los gatos', 'está', 'come'];` with
   `const accepted = [['los gatos'], ['está'], ['come']];`, and the two
   `gradeTypedAnswers(expected,` calls with `gradeTypedAnswers(accepted,`. Replace
   `gradeTypedAnswers(['Los gatos'],` (twice) with `gradeTypedAnswers([['Los gatos']],`
   and `gradeTypedAnswers(['¿Qué tal?'],` with `gradeTypedAnswers([['¿Qué tal?']],`.
5. In `describe('feedbackFor', …)`, add:

```ts
test('a reveal lists the other accepted answers, light-normalized; a hint never does', () => {
  expect(
    feedbackFor('gtererger', 'los gatos', REVEAL_AFTER_MISSES, 'strict', false, ['las  gatas']),
  ).toMatchObject({ kind: 'reveal', answer: 'los gatos', alsoAccepted: ['las gatas'] });
  expect(feedbackFor('gtererger', 'los gatos', 1, 'strict', false, ['las gatas'])).toEqual({
    kind: 'hint',
    reason: 'far',
  });
});
```

6. Before `describe('firstMarkedReveal', …)`, add:

```ts
// TODO §E54: a typed answer may accept more than one form, split by `|`.
describe('closestAlternative — which accepted answer a wrong one is compared with', () => {
  test('is the alternative most like the attempt', () => {
    expect(
      closestAlternative('в кругу семя', ['в семейном кругу', 'в кругу семьи', 'в семье']),
    ).toBe(1);
  });

  test('is the first on a tie', () => {
    expect(closestAlternative('rato', ['gato', 'pato'])).toBe(0);
  });

  test('compares as grading does: dictation drops punctuation, capitals fold', () => {
    expect(closestAlternative('HASTA LUEG', ['Adiós', '¡Hasta luego!'], 'dictation')).toBe(1);
  });
});

describe('gradeTypedAnswers — more than one accepted answer', () => {
  const family = [['в семейном кругу', 'в кругу семьи', 'в семье']];

  test('any accepted answer is right', () => {
    for (const value of ['в семейном кругу', 'в кругу семьи', 'В семье']) {
      expect(gradeTypedAnswers(family, { 0: value }, {}).checkedResults[0]).toBe(true);
    }
  });

  test('a wrong answer is hinted at against the closest answer', () => {
    expect(gradeTypedAnswers(family, { 0: 'в кругу семя' }, {}).feedback[0]).toEqual({
      kind: 'hint',
      reason: 'ending',
    });
  });

  test('the reveal shows the closest answer and lists the others in authored order', () => {
    const { feedback } = gradeTypedAnswers(family, { 0: 'в кругу семя' }, { 0: 1 });
    expect(feedback[0]).toMatchObject({
      kind: 'reveal',
      answer: 'в кругу семьи',
      alsoAccepted: ['в семейном кругу', 'в семье'],
    });
  });

  test('a tie between two answers goes to the first', () => {
    const { feedback } = gradeTypedAnswers([['gato', 'pato']], { 0: 'rato' }, { 0: 1 });
    expect(feedback[0]).toMatchObject({ kind: 'reveal', answer: 'gato', alsoAccepted: ['pato'] });
  });

  test('a single answer reveals nothing else', () => {
    expect(gradeTypedAnswers([['chat']], { 0: 'chien' }, { 0: 1 }).feedback[0]).toMatchObject({
      kind: 'reveal',
      alsoAccepted: [],
    });
  });

  test('dictation mode and caseSensitive apply to every alternative', () => {
    const goodbye = [['Adiós', '¡Hasta luego!']];
    expect(
      gradeTypedAnswers(goodbye, { 0: 'hasta luego' }, {}, 'dictation').checkedResults[0],
    ).toBe(true);
    expect(gradeTypedAnswers(goodbye, { 0: 'hasta luego' }, {}, 'strict').checkedResults[0]).toBe(
      false,
    );
    const city = [['Lima', 'Cuzco']];
    expect(gradeTypedAnswers(city, { 0: 'cuzco' }, {}).checkedResults[0]).toBe(true);
    expect(gradeTypedAnswers(city, { 0: 'cuzco' }, {}, 'strict', true).checkedResults[0]).toBe(
      false,
    );
  });
});
```

(Why `в кругу семя` gives `ending` against `в кругу семьи`: similarity ≈ 0.88; they share
the prefix `в кругу сем`, and the tails `я` / `ьи` are short and in the last word.)

In `src/exercises/lib/AnswerFeedback.test.tsx`, each of the three `kind: 'reveal'` literals
gains `alsoAccepted: [],` after its `segments` (type only; behaviour unchanged).

In `src/exercises/inline-gap/inline-gap-grading.test.ts`, append:

```ts
// TODO §E54: `|` means "or"; the first answer is the preferred one.
test('gradeInlineGap: any of a blank’s answers passes', () => {
  const blanks = [parseInputBlank('profesor|maestro|docente', 0).meta];
  expect(gradeInlineGap(blanks, { 0: 'maestro' }, 1).checkedResults[0]).toBe(true);
  expect(gradeInlineGap(blanks, { 0: 'docente' }, 1).checkedResults[0]).toBe(true);
  expect(gradeInlineGap(blanks, { 0: 'pintor' }, 1).checkedResults[0]).toBe(false);
});

test('fillInlineGapAnswers: fills each blank with its preferred (first) answer', () => {
  const blanks = [parseInputBlank('profesor|maestro|docente', 0).meta];
  expect(fillInlineGapAnswers(blanks, 1).values).toEqual({ 0: 'profesor' });
});
```

In `src/exercises/text-entry/text-entry-grading.test.ts`, append:

```ts
// TODO §E54: `|` means "or"; the first answer is the preferred one.
test('gradeTextEntry: any accepted answer passes', () => {
  const cars = rows('los coches|los carros|los autos');
  expect(gradeTextEntry(cars, { 0: 'los autos' }, 'strict').checkedResults[0]).toBe(true);
  expect(gradeTextEntry(cars, { 0: 'los coches' }, 'strict').checkedResults[0]).toBe(true);
});

test('fillAnswers: fills each row with its preferred (first) answer', () => {
  expect(fillAnswers(rows('los coches | los carros')).values).toEqual({ 0: 'los coches' });
});
```

In `src/exercises/conjugation/conjugation-grading.test.ts`, append inside the file (after
the last `describe`):

```ts
// TODO §E54: `|` means "or"; the first answer is the preferred one.
describe('more than one accepted form', () => {
  const plural: ConjugationRow[] = [{ person: 'ustedes', answer: 'hablan|ustedes hablan' }];

  test('any accepted form is right', () => {
    expect(gradeConjugation(plural, { 0: 'ustedes hablan' }).checkedResults[0]).toBe(true);
  });

  test('Show answers fills the preferred (first) form', () => {
    expect(fillConjugationAnswers(plural).values).toEqual({ 0: 'hablan' });
  });
});
```

- [ ] **Step 2: Run them, expect FAIL**

Run: `bun run test src/exercises/lib/answer-feedback.test.ts src/exercises/inline-gap src/exercises/text-entry src/exercises/conjugation`
Expected: FAIL — `closestAlternative is not a function`; reveals have no `alsoAccepted`;
the multi-answer `gradeTypedAnswers` tests fail because the old code compares the value
with the whole list stringified (`a,b,c`; a one-element list still passes by accident,
since `['x']` stringifies to `x`); the engine tests
fail because `maestro`, `los autos` and `ustedes hablan` are compared with the whole
`a|b|c` string (inline-gap: only with `expected`), and Show answers fills `los coches | los carros` and `hablan|ustedes hablan`.
(`fillInlineGapAnswers` already fills `profesor` since Task 2; that test pins it.)

- [ ] **Step 3: Implement `answer-feedback.ts`**

Add to the header comment, after the `WHAT IS COMPARED` paragraph:

```ts
 * MORE THAN ONE ANSWER (TODO §E54). Each gap or row has a list of accepted answers
 * (`splitAlternatives`, answer-alternatives.ts). Any of them is right. A wrong answer is
 * hinted at and revealed against the CLOSEST one (highest `similarity`, the first on a
 * tie), and the reveal lists the others in authored order (`alsoAccepted`).
```

Replace the `AnswerFeedback` type:

```ts
export type AnswerFeedback =
  | { kind: 'hint'; reason: MissReason }
  | {
      kind: 'reveal';
      answer: string;
      segments: readonly AnswerSegment[];
      /** The other accepted answers, in authored order, light-normalized; empty for one. */
      alsoAccepted: readonly string[];
    };
```

Insert before `feedbackFor`:

```ts
/**
 * Index of the accepted answer a wrong attempt is compared with: the one most like it
 * (`similarity` on the compared keys), the first on a tie. A learner who types
 * `в кругу семя` is told about the ending of `в кругу семьи`, not compared with
 * `в семейном кругу`.
 */
export function closestAlternative(
  typed: string,
  alternatives: readonly string[],
  mode: ComparisonMode = 'strict',
  caseSensitive = false,
): number {
  const typedKey = answerKey(typed, mode, caseSensitive);
  let closest = 0;
  let best = -1;
  alternatives.forEach((alternative, index) => {
    const score = similarity(typedKey, answerKey(alternative, mode, caseSensitive));
    if (score > best) {
      closest = index;
      best = score;
    }
  });
  return closest;
}
```

Replace `feedbackFor` (doc comment included):

```ts
/**
 * The feedback for one wrong answer after `misses` wrong Checks on it (this one
 * included): a hint until REVEAL_AFTER_MISSES, then the answer. `expected` is the
 * accepted answer the attempt is compared with (the closest, `closestAlternative`);
 * `alsoAccepted` are the others, shown on the reveal only, never with a hint.
 */
export function feedbackFor(
  typed: string,
  expected: string,
  misses: number,
  mode: ComparisonMode = 'strict',
  caseSensitive = false,
  alsoAccepted: readonly string[] = [],
): AnswerFeedback {
  const reason = classifyMiss(
    answerKey(typed, mode, caseSensitive),
    answerKey(expected, mode, caseSensitive),
  );
  if (misses < REVEAL_AFTER_MISSES) return { kind: 'hint', reason };
  const answer = normalizeAnswer(expected);
  return {
    kind: 'reveal',
    answer,
    segments:
      reason === 'far'
        ? [{ text: answer, differs: false }]
        : answerSegments(typed, expected, caseSensitive),
    alsoAccepted: alsoAccepted.map((alternative) => normalizeAnswer(alternative)),
  };
}
```

Replace `gradeTypedAnswers` (doc comment included):

```ts
/**
 * Grade one Check over a set of typed answers (rows, blanks). `accepted` holds, per
 * answer, every form it accepts (`splitAlternatives`); a value matching any of them is
 * right. Empty answers are skipped. Each wrong answer's miss count goes up by one and
 * decides between a hint and the revealed answer, both against the closest form. The
 * engines' own grading modules are thin wrappers.
 */
export function gradeTypedAnswers(
  accepted: readonly (readonly string[])[],
  values: Readonly<Record<number, string>>,
  previousMisses: Readonly<Record<number, number>>,
  mode: ComparisonMode = 'strict',
  caseSensitive = false,
): TypedGradeResult {
  const checkedResults: Record<number, boolean> = {};
  const feedback: Record<number, AnswerFeedback> = {};
  const misses: Record<number, number> = { ...previousMisses };
  accepted.forEach((alternatives, index) => {
    const value = values[index] ?? '';
    if (value.trim() === '') return; // grade only answers the learner filled
    const typedKey = answerKey(value, mode, caseSensitive);
    const isCorrect = alternatives.some(
      (alternative) => answerKey(alternative, mode, caseSensitive) === typedKey,
    );
    checkedResults[index] = isCorrect;
    if (isCorrect) return;
    misses[index] = (misses[index] ?? 0) + 1;
    const closest = closestAlternative(value, alternatives, mode, caseSensitive);
    const others = alternatives.filter((_, i) => i !== closest);
    feedback[index] = feedbackFor(
      value,
      alternatives[closest] ?? '',
      misses[index],
      mode,
      caseSensitive,
      others,
    );
  });
  return { checkedResults, feedback, misses };
}
```

- [ ] **Step 4: Implement the three wrappers**

`src/exercises/inline-gap/inline-gap-grading.ts` — `gradeInlineGap`'s body becomes:

```ts
const accepted = Array.from({ length: nToSolve }, (_, i) => blanksMeta[i]?.accepted ?? ['']);
return gradeTypedAnswers(accepted, values, misses, 'strict', caseSensitive);
```

and its doc comment's first sentence becomes "Grade the first `nToSolve` blanks against
the answers each accepts (`|` between them, TODO §E54; accent-strict, capitals ignored
unless `caseSensitive`)." `fillInlineGapAnswers` is unchanged (it fills `expected`, the
first answer); its comment becomes "Reveal every answer: fill each blank with its
preferred (first) answer, all correct."

`src/exercises/text-entry/text-entry-grading.ts` — add
`import { splitAlternatives } from '@/exercises/lib/answer-alternatives';`, then:

```ts
return gradeTypedAnswers(
  rows.map((row) => splitAlternatives(row.answer)),
  values,
  misses,
  mode,
  caseSensitive,
);
```

and in `fillAnswers`, `values[index] = row.answer;` becomes
`values[index] = splitAlternatives(row.answer)[0];` with its comment "fill each row with its
preferred (first) answer". The existing "reveals the raw answer verbatim" test stays green
(`Bonjour, ça va ?` has no `|`).

`src/exercises/conjugation/conjugation-grading.ts` — add the same import, then:

```ts
return gradeTypedAnswers(
  rows.map((row) => splitAlternatives(row.answer)),
  values,
  misses,
  'strict',
  caseSensitive,
);
```

and in `fillConjugationAnswers`, `values[i] = rows[i]?.answer ?? '';` becomes
`values[i] = splitAlternatives(rows[i]?.answer ?? '')[0];`.

- [ ] **Step 5: Run, expect PASS**

Run: `bun run test src/exercises && bunx tsc -b`
Expected: PASS; `tsc` clean (it fails on any `{ kind: 'reveal' }` literal still missing
`alsoAccepted`).

- [ ] **Step 6: Commit**

```bash
git add src/exercises/lib/answer-feedback.ts src/exercises/lib/answer-feedback.test.ts src/exercises/lib/AnswerFeedback.test.tsx src/exercises/inline-gap/inline-gap-grading.ts src/exercises/inline-gap/inline-gap-grading.test.ts src/exercises/text-entry/text-entry-grading.ts src/exercises/text-entry/text-entry-grading.test.ts src/exercises/conjugation/conjugation-grading.ts src/exercises/conjugation/conjugation-grading.test.ts
git commit -m "feat: grade a typed answer against any of its alternatives

The hint and the revealed diff use the closest alternative, the first on a
tie; the reveal lists the others. Show answers fills the first.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: the shared load checks in `answer-checks.ts`

**Files:**

- Modify: `src/exercises/lib/answer-checks.ts`
- Create: `src/exercises/lib/answer-checks.test.ts`

- [ ] **Step 1: Write the failing test**

`src/exercises/lib/answer-checks.test.ts`:

```ts
/**
 * answer-checks.test.ts — the load checks for a typed answer with more than one form
 * (TODO §E54): none empty, none accepted twice, compared as the engine grades. Each
 * returns the END of a sentence; the schema starts it ("row 2 …", "the blank […] …").
 */
import { describe, expect, test } from 'vitest';
import { normalizeAnswer, normalizeForDictation } from './answers';
import {
  emptyAlternativeProblems,
  hasTypedAnswer,
  repeatedAlternativeProblems,
  typedAnswerProblems,
} from './answer-checks';

const EMPTY = 'has an empty answer: remove the extra |';

describe('typedAnswerProblems', () => {
  test('finds nothing wrong with one answer or several', () => {
    expect(typedAnswerProblems('soy', normalizeAnswer)).toEqual([]);
    expect(typedAnswerProblems('обеспеченные|состоятельные|богатые', normalizeAnswer)).toEqual([]);
  });

  test.each(['a|', '|a', 'a||b', 'a| |b'])('names an empty answer: %s', (answer) => {
    expect(typedAnswerProblems(answer, normalizeAnswer)).toEqual([EMPTY]);
  });

  test('leaves a lone empty answer to the "has no answer" check', () => {
    expect(typedAnswerProblems(' ', normalizeAnswer)).toEqual([]);
  });

  test('names an answer accepted twice, compared as grading compares', () => {
    expect(typedAnswerProblems('soy|eres|soy', normalizeAnswer)).toEqual([
      'accepts "soy" twice: each answer must differ',
    ]);
    expect(typedAnswerProblems("l'eau|l’eau", normalizeAnswer)).toEqual([
      `accepts "l'eau" twice: each answer must differ`,
    ]);
  });

  test('judges as written: an entity is not decoded', () => {
    expect(typedAnswerProblems('é|&eacute;', normalizeAnswer)).toEqual([]);
  });

  test('folds capitals unless the exercise is caseSensitive', () => {
    expect(typedAnswerProblems('Soy|soy', normalizeAnswer)).toEqual([
      'accepts "soy" twice: each answer must differ',
    ]);
    expect(typedAnswerProblems('Soy|soy', normalizeAnswer, true)).toEqual([]);
  });

  test("compares with the engine's own normalizing", () => {
    expect(typedAnswerProblems('Hola|¡Hola!', normalizeForDictation)).toEqual([
      'accepts "Hola" twice: each answer must differ',
    ]);
    expect(typedAnswerProblems('Hola|¡Hola!', normalizeAnswer)).toEqual([]);
  });

  test('names an empty answer and a repeat together', () => {
    expect(typedAnswerProblems('a||a', normalizeAnswer)).toEqual([
      EMPTY,
      'accepts "a" twice: each answer must differ',
    ]);
  });
});

describe('the pieces, for answers already split and decoded (inline-gap)', () => {
  test('emptyAlternativeProblems needs two or more answers to name one empty', () => {
    expect(emptyAlternativeProblems(['a', ''])).toEqual([EMPTY]);
    expect(emptyAlternativeProblems([''])).toEqual([]);
  });

  test('repeatedAlternativeProblems reports the first repeat only', () => {
    expect(repeatedAlternativeProblems(['a', 'b', 'a', 'b'], normalizeAnswer, false)).toEqual([
      'accepts "a" twice: each answer must differ',
    ]);
  });
});

describe('hasTypedAnswer', () => {
  test('is false only when the engine’s normalizing leaves nothing', () => {
    expect(hasTypedAnswer('soy', normalizeAnswer)).toBe(true);
    expect(hasTypedAnswer('  ', normalizeAnswer)).toBe(false);
    expect(hasTypedAnswer('¿?', normalizeForDictation)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bun run test src/exercises/lib/answer-checks.test.ts`
Expected: FAIL — `typedAnswerProblems is not a function` (and the other two); the
`hasTypedAnswer` block passes.

- [ ] **Step 3: Implement**

In `src/exercises/lib/answer-checks.ts`, add to the header comment, after the `JUDGED AS
WRITTEN` paragraph:

```ts
 * TYPED ANSWERS WITH MORE THAN ONE FORM (TODO §E54). `|` splits a typed answer into the
 * forms it accepts (answer-alternatives.ts). None may be empty, and no two may grade the
 * same: compared with the engine's own normalizing, capitals folded unless the exercise
 * is `caseSensitive`, as `answerKey` (answer-feedback.ts) compares them. These checks
 * return the END of a sentence; the schema names the row or blank that starts it.
```

Add the import:

```ts
import { splitAlternatives } from './answer-alternatives';
```

Append at the end of the file:

```ts
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
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bun run test src/exercises/lib/answer-checks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/lib/answer-checks.ts src/exercises/lib/answer-checks.test.ts
git commit -m "feat: check a typed answer's alternatives at load

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: inline-gap refuses an empty or repeated answer

The `*` check stays (a pasted choice blank); the `|` check goes. Empty answers are judged
per blank in `inputBlankProblems` (content level); repeats in a new
`inputBlankRepeatProblems(text, caseSensitive)`, run by the envelope schema, which sees
`options.caseSensitive`.

**Files:**

- Modify: `src/exercises/lib/parsing.ts` (`inputBlankProblems`, new `inputBlankRepeatProblems`)
- Modify: `src/exercises/lib/parsing.test.ts`
- Modify: `src/exercises/inline-gap/inline-gap-schema.ts`
- Modify: `src/exercises/inline-gap/inline-gap-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/exercises/lib/parsing.test.ts`, add `inputBlankRepeatProblems` to the import list,
then, after `describe('inputBlankProblems', …)`, add:

```ts
// TODO §E54: `|` means "or" in a typed blank. A pasted choice is still caught by its `*`.
describe('inputBlankProblems — more than one answer', () => {
  test('accepts several answers split by |', () => {
    expect(
      inputBlankProblems('Vivo [в семейном кругу|в кругу семьи|в семье::in the family circle].'),
    ).toEqual([]);
  });

  test.each(['Yo [soy||eres::ser].', 'Yo [soy|::ser].', 'Yo [|soy].', 'Yo [soy|&nbsp;].'])(
    'names an empty answer: %s',
    (text) => {
      expect(inputBlankProblems(text)).toEqual([
        expect.stringContaining('has an empty answer: remove the extra |'),
      ]);
    },
  );

  test('a blank of only | has no answer', () => {
    expect(inputBlankProblems('Yo [|] Ana.')).toEqual([expect.stringContaining('has no answer')]);
  });

  test.each(['Yo [*soy|eres|es].', 'Yo [soy|*eres].'])(
    'still names a pasted choice by its *: %s',
    (text) => {
      expect(inputBlankProblems(text)).toEqual([expect.stringContaining('is written as a choice')]);
    },
  );

  test('reads &#124; and &#42; as text, never an "or" or a mark', () => {
    expect(inputBlankProblems('[a&#124;b::hint] [&#42;a|b]')).toEqual([]);
  });
});

describe('inputBlankRepeatProblems', () => {
  test('names an answer accepted twice', () => {
    expect(inputBlankRepeatProblems('Yo [soy|eres|soy].', false)).toEqual([
      'the blank [soy|eres|soy] accepts "soy" twice: each answer must differ',
    ]);
  });

  test.each(['[é|&eacute;]', '[l&apos;eau|l’eau]', '[a  b|a b]'])(
    'judges each answer decoded, as grading does: %s',
    (blank) => {
      expect(inputBlankRepeatProblems(`Y ${blank}.`, false)).toEqual([
        expect.stringMatching(/accepts ".+" twice/),
      ]);
    },
  );

  test('folds capitals unless the exercise is caseSensitive', () => {
    expect(inputBlankRepeatProblems('[Lo|lo]', false)).toEqual([
      expect.stringContaining('accepts "lo" twice'),
    ]);
    expect(inputBlankRepeatProblems('[Lo|lo]', true)).toEqual([]);
  });

  test('finds nothing in blanks with one answer each', () => {
    expect(inputBlankRepeatProblems('[soy] y [eres|estás]', false)).toEqual([]);
  });
});
```

In `src/exercises/inline-gap/inline-gap-schema.test.ts`, append:

```ts
// TODO §E54: "twice" depends on options.caseSensitive, which only the envelope sees.
describe('InlineGapExerciseConfigSchema — an answer accepted twice', () => {
  const config = (text: string, options?: { caseSensitive: boolean }) => ({
    type: 'inline-gap',
    content: { items: [{ text: 'Yo [soy::ser].' }, { text }] },
    ...(options ? { options } : {}),
  });

  test('accepts several different answers', () => {
    expect(
      InlineGapExerciseConfigSchema.safeParse(config('Mi padre es [profesor|maestro|docente].'))
        .success,
    ).toBe(true);
  });

  test('refuses a repeat, on its own sentence', () => {
    const result = InlineGapExerciseConfigSchema.safeParse(config('Yo [soy|Soy::ser].'));
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['content', 'items', 1, 'text'],
    ]);
    expect(result.error?.issues[0].message).toBe(
      'the blank [soy|Soy::ser] accepts "soy" twice: each answer must differ',
    );
  });

  test('keeps two answers that differ by a capital when capitals count', () => {
    expect(
      InlineGapExerciseConfigSchema.safeParse(config('Yo [soy|Soy::ser].', { caseSensitive: true }))
        .success,
    ).toBe(true);
  });

  test('refuses an empty answer at the content level', () => {
    const result = InlineGapContentSchema.safeParse({ items: [{ text: 'Yo [soy|::ser].' }] });
    expect(result.error?.issues[0].message).toContain('has an empty answer: remove the extra |');
  });
});
```

- [ ] **Step 2: Run them, expect FAIL**

Run: `bun run test src/exercises/lib/parsing.test.ts src/exercises/inline-gap`
Expected: FAIL — `inputBlankRepeatProblems is not a function`; every blank with a `|`
(the several-answers, empty-answer and `[a&#124;b…] [&#42;a|b]` cases) is reported "is
written as a choice"; the envelope refuses `[soy|Soy::ser]` with that same message
instead of "accepts "soy" twice", and refuses `[profesor|maestro|docente]` and the
`caseSensitive` case too.

- [ ] **Step 3: Implement `parsing.ts`**

Add the import:

```ts
import { emptyAlternativeProblems, repeatedAlternativeProblems } from './answer-checks';
```

(`splitAlternatives` is already imported since Task 2.) Replace `inputBlankProblems`
(doc comment included):

```ts
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
```

In the header comment, the sentence "`choiceBlankProblems` and `inputBlankProblems` are the
content checks the engine schemas run at load (TODO §E34)." gains: "`inputBlankRepeatProblems`
is the one the inline-gap envelope runs, since it needs `options.caseSensitive` (§E54)."

- [ ] **Step 4: Implement the envelope check**

In `src/exercises/inline-gap/inline-gap-schema.ts`, change the parsing import to
`import { inputBlankProblems, inputBlankRepeatProblems } from '../lib/parsing';` and
replace `InlineGapExerciseConfigSchema` (doc comment included):

```ts
/**
 * The full exercise envelope for an inline-gap exercise: the shared
 * `type`/`options`/`labels` from ExerciseConfigSchema, with `content` narrowed to
 * InlineGapContentSchema and `type` pinned to the literal `'inline-gap'`. An answer
 * accepted twice is checked here, the one schema that sees `options.caseSensitive`,
 * which decides whether `Soy` and `soy` are the same answer (TODO §E54).
 */
export const InlineGapExerciseConfigSchema = ExerciseConfigSchema.extend({
  type: z.literal('inline-gap'),
  content: InlineGapContentSchema,
}).superRefine((config, ctx) => {
  const caseSensitive = config.options?.caseSensitive ?? false;
  config.content.items.forEach((item, index) => {
    for (const message of inputBlankRepeatProblems(item.text, caseSensitive)) {
      ctx.addIssue({ code: 'custom', message, path: ['content', 'items', index, 'text'] });
    }
  });
});
```

Its header's "Blanks use `[expected::placeholder]`" sentence gains: "Several answers are
split by `|`, the first preferred: `[profesor|maestro::trabajo]` (TODO §E54)."

- [ ] **Step 5: Run, expect PASS**

Run: `bun run test src/exercises && bunx tsc -b`
Expected: PASS, including `exercise-schemas.test.ts` (every fixture still accepted) and
the E42 matrix.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/lib/parsing.ts src/exercises/lib/parsing.test.ts src/exercises/inline-gap/inline-gap-schema.ts src/exercises/inline-gap/inline-gap-schema.test.ts
git commit -m "feat: refuse an inline-gap blank with an empty or repeated answer

A | now means \"or\"; a pasted choice blank is still caught by its *.
\"Twice\" is judged on the envelope, which sees options.caseSensitive.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: the table engines refuse an empty or repeated alternative

**Files:**

- Modify: `src/exercises/typed-transform/typed-transform-schema.ts`
- Modify: `src/exercises/dictation/dictation-schema.ts`
- Modify: `src/exercises/conjugation/conjugation-schema.ts`
- Modify: `src/exercises/text-entry/text-entry-schema.ts` (header comment only)
- Modify: `src/exercises/answer-validation.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/exercises/answer-validation.test.ts`, replace `problems`:

```ts
function problems(type: ExerciseType, content: unknown, options?: object): string[] {
  const result = exerciseConfigSchema(type).safeParse({
    type,
    content,
    ...(options && { options }),
  });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}
```

In the header matrix, the two "typed answer in its own field" rows become:

```ts
 * | typed answer in its own field    | typed-transform, conjugation                   | non-empty after normalizeAnswer; `|` alts    |
 * |                                  | dictation                                      | non-empty after normalizeForDictation; alts  |
```

and add below the table's closing line: `* A typed answer's`|` alternatives (E54) may not be empty or repeat, compared as grading compares them.`

After `describe('typed answers mean something after the engine normalizes them', …)`, add:

```ts
// TODO §E54: `|` means "or" in a typed answer, the first preferred.
describe('typed answers with more than one form', () => {
  const rows = (answer: string) => ({ rows: [{ prompt: 'x', answer, audio: 'audio/a.m4a' }] });
  const conjugation = (answer: string) => ({
    verb: 'ser',
    rows: [
      { person: 'yo', answer: 'soy' },
      { person: 'tú', answer },
    ],
  });

  it('accepts several answers in every table engine', () => {
    expect(problems('typed-transform', rows('los coches|los carros|los autos'))).toEqual([]);
    expect(problems('dictation', rows('Adiós|Hasta luego|Chao'))).toEqual([]);
    expect(problems('conjugation', conjugation('eres|sos'))).toEqual([]);
  });

  it.each(['soy|', 'soy||eres', '|soy'])('refuses an empty answer: %s', (answer) => {
    expect(problems('typed-transform', rows(answer))).toEqual([
      'row 1 has an empty answer: remove the extra |',
    ]);
    expect(problems('dictation', rows(answer))).toEqual([
      'row 1 has an empty answer: remove the extra |',
    ]);
    expect(problems('conjugation', conjugation(answer))).toEqual([
      'row 2 (tú) has an empty answer: remove the extra |',
    ]);
  });

  it('refuses the same answer twice, compared as that engine grades', () => {
    expect(problems('typed-transform', rows('los autos|Los  autos'))).toEqual([
      'row 1 accepts "Los autos" twice: each answer must differ',
    ]);
    expect(problems('dictation', rows('Hola|¡Hola!'))).toEqual([
      'row 1 accepts "Hola" twice: each answer must differ',
    ]);
    expect(problems('typed-transform', rows('Hola|¡Hola!'))).toEqual([]);
  });

  it('lets two answers differ by a capital only when capitals count', () => {
    expect(problems('conjugation', conjugation('Eres|eres'))).toEqual([
      'row 2 (tú) accepts "eres" twice: each answer must differ',
    ]);
    expect(problems('conjugation', conjugation('Eres|eres'), { caseSensitive: true })).toEqual([]);
    expect(problems('typed-transform', rows('Eres|eres'), { caseSensitive: true })).toEqual([]);
  });

  it("refuses a dictation alternative that is only what dictation's grading ignores", () => {
    expect(problems('dictation', rows('Hola|¿?')).join()).toMatch(/row 1 has nothing to type/);
    expect(problems('typed-transform', rows('Hola|¿?'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bun run test src/exercises/answer-validation.test.ts`
Expected: FAIL — every empty-answer and repeat case returns `[]` (nothing checks
alternatives yet), and `Hola|¿?` is accepted by dictation (its check reads the whole
string, `Hola|`).

- [ ] **Step 3: Implement typed-transform**

`src/exercises/typed-transform/typed-transform-schema.ts`, below the header comment:

```ts
import { z } from 'zod';
import { ExerciseConfigSchema } from '@/config/lo-schema';
import { typedAnswerProblems } from '../lib/answer-checks';
import { normalizeAnswer } from '../lib/answers';
import { TextEntryContentSchema } from '../text-entry/text-entry-schema';

export const TypedTransformExerciseConfigSchema = ExerciseConfigSchema.extend({
  type: z.literal('typed-transform'),
  content: TextEntryContentSchema,
})
  // An answer's `|` alternatives (TODO §E54): none empty, none twice. Checked here, on
  // the envelope, the one schema that sees `options.caseSensitive`.
  .superRefine((config, ctx) => {
    const caseSensitive = config.options?.caseSensitive ?? false;
    config.content.rows.forEach((row, index) => {
      for (const end of typedAnswerProblems(row.answer, normalizeAnswer, caseSensitive)) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${index + 1} ${end}`,
          path: ['content', 'rows', index, 'answer'],
        });
      }
    });
  });
export type TypedTransformExerciseConfig = z.infer<typeof TypedTransformExerciseConfigSchema>;
```

- [ ] **Step 4: Implement dictation**

`src/exercises/dictation/dictation-schema.ts`: add
`import { splitAlternatives } from '../lib/answer-alternatives';` and change the
`answer-checks` import to `import { hasTypedAnswer, typedAnswerProblems } from '../lib/answer-checks';`.
The punctuation `.superRefine` on `DictationContentSchema` becomes, per alternative:

```ts
  // Dictation grades with punctuation and quotes ignored, so an answer, or one of its `|`
  // alternatives, of only those leaves nothing to type (TODO §E42, §E54). A blank answer
  // is already refused above; an empty alternative is refused on the envelope.
  .superRefine((content, ctx) => {
    content.rows.forEach((row, index) => {
      const silent = splitAlternatives(row.answer).some(
        (alternative) =>
          hasTypedAnswer(alternative, normalizeAnswer) &&
          !hasTypedAnswer(alternative, normalizeForDictation),
      );
      if (silent) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${index + 1} has nothing to type: dictation ignores punctuation and quotes, so the answer needs words`,
          path: ['rows', index, 'answer'],
        });
      }
    });
  });
```

(A whitespace-only answer splits to `['']`, which `hasTypedAnswer(…, normalizeAnswer)`
skips, so the old `blank` guard is no longer needed: the existing "row 1 has no answer"
test still gets only that message.) Then:

```ts
export const DictationExerciseConfigSchema = ExerciseConfigSchema.extend({
  type: z.literal('dictation'),
  content: DictationContentSchema,
})
  // An answer's `|` alternatives (TODO §E54), compared as dictation grades them:
  // punctuation and quotes ignored, capitals folded unless `options.caseSensitive`.
  .superRefine((config, ctx) => {
    const caseSensitive = config.options?.caseSensitive ?? false;
    config.content.rows.forEach((row, index) => {
      for (const end of typedAnswerProblems(row.answer, normalizeForDictation, caseSensitive)) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${index + 1} ${end}`,
          path: ['content', 'rows', index, 'answer'],
        });
      }
    });
  });
```

- [ ] **Step 5: Implement conjugation**

`src/exercises/conjugation/conjugation-schema.ts`: change the import to
`import { hasTypedAnswer, typedAnswerProblems } from '../lib/answer-checks';` and replace
`ConjugationExerciseConfigSchema`:

```ts
export const ConjugationExerciseConfigSchema = ExerciseConfigSchema.extend({
  type: z.literal('conjugation'),
  content: ConjugationContentSchema,
})
  // A form's `|` alternatives (TODO §E54): none empty, none twice. Checked here, on the
  // envelope, the one schema that sees `options.caseSensitive`.
  .superRefine((config, ctx) => {
    const caseSensitive = config.options?.caseSensitive ?? false;
    config.content.rows.forEach((row, index) => {
      for (const end of typedAnswerProblems(row.answer, normalizeAnswer, caseSensitive)) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${index + 1} (${row.person}) ${end}`,
          path: ['content', 'rows', index, 'answer'],
        });
      }
    });
  });
```

In `ConjugationRowSchema`, the `answer` doc comment becomes "The expected verb form the
learner must produce; several accepted forms are split by `|`, the first preferred (TODO
§E54)." In `text-entry-schema.ts`'s header, the `answer` line becomes
"`answer    the expected typed response; several accepted forms split by \`|\`, the first preferred (TODO §E54).`"

The three envelope blocks differ in the normalizer and the row's name, so they are kept
inline rather than folded into a helper that would take both as parameters.

- [ ] **Step 6: Run, expect PASS**

Run: `bun run test src/exercises && bunx tsc -b`
Expected: PASS, the existing E42 tests included (`row 1 has no answer`, `row 1 has nothing
to type`, `row 2 (tú) has no answer`) and every fixture.

- [ ] **Step 7: Commit**

```bash
git add src/exercises/typed-transform/typed-transform-schema.ts src/exercises/dictation/dictation-schema.ts src/exercises/conjugation/conjugation-schema.ts src/exercises/text-entry/text-entry-schema.ts src/exercises/answer-validation.test.ts
git commit -m "feat: refuse table answers with an empty or repeated alternative

typed-transform, dictation and conjugation check each answer's | alternatives
on the envelope, compared as that engine grades them.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: "Also accepted:" under a revealed answer

**Files:**

- Modify: `src/config/ui-strings.ts`, `src/config/ui-strings.test.ts`
- Modify: `src/exercises/lib/AnswerFeedback.tsx`, `AnswerFeedback.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/config/ui-strings.test.ts`:

```ts
// TODO §E54: a revealed answer lists the other accepted ones under this label.
test('ui-strings: alsoAccepted labels the other accepted answers, and can be reworded', () => {
  expect(resolveLabel('alsoAccepted')).toBe('Also accepted:');
  expect(resolveLabel('alsoAccepted', { alsoAccepted: 'Or:' })).toBe('Or:');
  expect(UiStringsOverrideSchema.safeParse({ alsoAccepted: 'Or:' }).success).toBe(true);
});
```

In `src/exercises/lib/AnswerFeedback.test.tsx`, add
`import type { AnswerFeedback as Feedback } from './answer-feedback';` and append inside
`describe('AnswerFeedback', …)`:

```ts
  // TODO §E54: a typed answer may accept more than one form.
  const revealOf = (alsoAccepted: readonly string[]): Feedback => ({
    kind: 'reveal',
    answer: 'profesor',
    segments: [{ text: 'profesor', differs: false }],
    alsoAccepted,
  });

  test('a reveal lists the other accepted answers in the course language, after the answer', () => {
    const html = renderToStaticMarkup(
      <AnswerFeedback feedback={revealOf(['maestro', 'docente'])} contentLang="es" />,
    );

    expect(html).toContain('Also accepted:');
    expect(html).toMatch(/<span lang="es"[^>]*>maestro · docente<\/span>/);
    expect(html.indexOf('Also accepted:')).toBeGreaterThan(html.indexOf('profesor'));
  });

  test('one accepted answer: no "Also accepted" line', () => {
    const html = renderToStaticMarkup(<AnswerFeedback feedback={revealOf([])} contentLang="es" />);
    expect(html).not.toContain('Also accepted');
  });

  test('an exercise can reword the label', () => {
    const html = renderToStaticMarkup(
      <AnswerFeedback
        feedback={revealOf(['maestro'])}
        contentLang="es"
        labels={{ alsoAccepted: 'Or:' }}
      />,
    );
    expect(html).toContain('Or:');
    expect(html).not.toContain('Also accepted');
  });
```

- [ ] **Step 2: Run them, expect FAIL**

Run: `bun run test src/config/ui-strings.test.ts src/exercises/lib/AnswerFeedback.test.tsx`
Expected: FAIL — `resolveLabel('alsoAccepted')` is `undefined`, the override is rejected
(strict schema, unknown key), and the markup has no "Also accepted" line.

- [ ] **Step 3: Implement**

`src/config/ui-strings.ts` — in `UiStringsSchema`, after `answerKey: z.string().min(1),`:

```ts
  // The other accepted answers under a revealed one (TODO §E54): "Also accepted: a · b".
  alsoAccepted: z.string().min(1),
```

and in `raw`, after `answerKey: 'Highlighted: what differs from yours',`:

```ts
  alsoAccepted: 'Also accepted:',
```

`src/exercises/lib/AnswerFeedback.tsx` — in the header comment, after the `reveal:` bullet,
add:

```ts
 *   - also:   under a reveal whose blank or row accepts more than one answer, "Also
 *             accepted:" and the others joined with " · ", in the course language
 *             (TODO §E54). Part of the feedback text, so a screen reader hears it too.
```

In the reveal branch, between the closing `</span>` of the `LINE` span and
`{showKey && marked.length > 0 ? (`, insert:

```tsx
{
  feedback.alsoAccepted.length > 0 ? (
    // ms-6: under the answer's text, past the icon (size-4 + gap-2).
    <span className="ms-6 text-sm text-foreground">
      {resolveLabel('alsoAccepted', labels)}{' '}
      <span lang={contentLang}>{feedback.alsoAccepted.join(' · ')}</span>
    </span>
  ) : null;
}
```

Tokens only (Tailwind utilities on theme tokens), no new colour, no CSS file change.

- [ ] **Step 4: Run, expect PASS**

Run: `bun run test src/config src/exercises/lib src/guards && bunx tsc -b`
Expected: PASS (guard h's semantic-DOM sweep renders the fixtures; a span in a span is fine).

- [ ] **Step 5: Commit**

```bash
git add src/config/ui-strings.ts src/config/ui-strings.test.ts src/exercises/lib/AnswerFeedback.tsx src/exercises/lib/AnswerFeedback.test.tsx
git commit -m "feat: list the other accepted answers under a revealed one

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: in the browser, a typed gap accepts any of its answers

Written first against the showcase, where the `inline-gap` card has no sixth blank yet;
then the fixture sentence that makes it pass.

**Files:**

- Create: `e2e/debug/typed-answer-alternatives.spec.ts`
- Modify: `src/exercises/inline-gap/inline-gap.fixture.ts`

- [ ] **Step 1: Write the failing spec**

`e2e/debug/typed-answer-alternatives.spec.ts`:

```ts
/**
 * typed-answer-alternatives.spec.ts — a typed gap that accepts more than one answer
 * (TODO §E54; docs/specs/2026-11-10-typed-answer-alternatives-design.md §8). The
 * `inline-gap` showcase card's last sentence is `[profesor|maestro|docente::su trabajo]`
 * (inline-gap.fixture.ts), its sixth blank of six. Written here, not imported: the
 * fixture's own imports use the `@/` alias, which this folder's tsconfig does not have.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoAxeViolations } from '../support';
import { card, openShowcase } from './debug-support';

const FIXTURE = 'inline-gap';
const BLANK = 'Answer for blank 6';

async function openGap(page: Page): Promise<{ exercise: Locator; blank: Locator }> {
  await openShowcase(page);
  const exercise = card(page, FIXTURE);
  return { exercise, blank: exercise.getByLabel(BLANK) };
}

test('an answer that is not the preferred one is marked right', async ({ page }) => {
  const { exercise, blank } = await openGap(page);

  await blank.fill('maestro');
  await exercise.getByRole('button', { name: 'Check' }).click();

  await expect(blank).toHaveAttribute('aria-invalid', 'false');
  await expect(exercise.getByRole('status')).toContainText('1 correct out of 6');
});

test('a revealed wrong answer lists the others, axe stays clean, Show answers fills the preferred', async ({
  page,
}) => {
  const { exercise, blank } = await openGap(page);
  const check = exercise.getByRole('button', { name: 'Check' });

  await blank.fill('pintor');
  await check.click(); // the first wrong Check: a hint, no answers
  await expect(exercise.getByText('Also accepted:')).toHaveCount(0);
  await check.click(); // the second: the closest answer, and the others

  await expect(exercise.getByText('Also accepted:')).toBeVisible();
  const others = exercise.getByText('maestro · docente', { exact: true });
  await expect(others).toBeVisible();
  await expect(others).toHaveAttribute('lang', (await blank.getAttribute('lang')) ?? '');
  await expectNoAxeViolations(page, `article#${FIXTURE}`);

  await exercise.getByRole('button', { name: 'Show answers' }).click();
  await expect(blank).toHaveValue('profesor');
});
```

(`pintor` is a far miss from all three; `profesor` is the closest (similarity ≈ 0.43
against ≈ 0.31 for the others), so the reveal reads "Answer: profesor" and "Also
accepted: maestro · docente".)

- [ ] **Step 2: Run it, expect FAIL**

Run: `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e e2e/debug/typed-answer-alternatives.spec.ts`
(Node 22, `.nvmrc`; browsers installed once with `bunx playwright install chromium firefox webkit`.)
Expected: FAIL in all three browsers — `getByLabel('Answer for blank 6')` resolves to no
element (the card has five blanks).

- [ ] **Step 3: Add the fixture sentence**

In `src/exercises/inline-gap/inline-gap.fixture.ts`, the first card (`id: 'inline-gap'`):
the `items` array gains, after the `Mi hermana [tiene::tener] …` item:

```ts
          // Three accepted answers (TODO §E54): `|` means "or", the first preferred.
          // Show answers fills `profesor`; a revealed miss lists the others.
          { text: 'Mi padre es [profesor|maestro|docente::su trabajo] en un colegio.' },
```

and the comment above `items` "A wrong Check shows a character diff under the box." becomes
"A wrong Check shows a hint, then the answer under the box; `|` separates answers that are
all right."

- [ ] **Step 4: Run, expect PASS**

Run: `bun run test src/exercises/exercise-schemas.test.ts src/showcase src/guards && DEBUG=1 bun run build && DEBUG=1 bun run test:e2e e2e/debug/typed-answer-alternatives.spec.ts`
Expected: PASS — the fixture is accepted by its schema; 2 tests × 3 browsers pass.

- [ ] **Step 5: Commit**

```bash
git add e2e/debug/typed-answer-alternatives.spec.ts src/exercises/inline-gap/inline-gap.fixture.ts
git commit -m "test: a typed gap accepts any of its answers in the browser

The inline-gap showcase card gains a sentence with three answers.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: the three table fixtures show three answers each

The fixtures are parsed through their envelope schemas by
`src/exercises/exercise-schemas.test.ts`, so that test proves the syntax passes the
build. To see it bite, temporarily write `"los autos|los autos"` in the typed-transform
row: the test fails with `row 5 accepts "los autos" twice`; then write the row below.

**Files:**

- Modify: `src/exercises/typed-transform/typed-transform.fixture.ts`
- Modify: `src/exercises/dictation/dictation.fixture.ts`
- Modify: `src/exercises/conjugation/conjugation.fixture.ts`

- [ ] **Step 1: Add the rows**

typed-transform, first card (`id: 'typed-transform'`), `rows` gains after `la canción`:

```ts
          // Three accepted answers (TODO §E54): `|` means "or", the first preferred.
          { prompt: 'el coche', answer: 'los coches|los carros|los autos' },
```

dictation (`id: 'dictation'`), `rows` gains after `Hasta luego`:

```ts
          // Three accepted answers (TODO §E54): `|` means "or", the first preferred.
          { answer: 'Adiós|Chao|Nos vemos', audio: 'audio/showcase-demo/inline-gap/q1.wav' },
```

conjugation, second card (`id: 'conjugation-ar-verb'`), `rows` gains after `ellos/ellas`:

```ts
          // Three accepted answers (TODO §E54): `|` means "or", the first preferred.
          { person: 'ustedes', answer: 'hablan|ustedes hablan|Uds. hablan' },
```

- [ ] **Step 2: Run, expect PASS**

Run: `bun run test src/exercises/exercise-schemas.test.ts src/showcase src/guards`
Expected: PASS (the dictation clip exists, so `showcase-audio-assets.test.ts` stays green).

- [ ] **Step 3: Commit**

```bash
git add src/exercises/typed-transform/typed-transform.fixture.ts src/exercises/dictation/dictation.fixture.ts src/exercises/conjugation/conjugation.fixture.ts
git commit -m "test: show three accepted answers in each table engine's fixture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: docs

Re-read each file immediately before editing it. Run `bun run format` before the commit:
Prettier re-pads the tables. No `_underscore_` emphasis in table cells.

**Files:**

- Modify: `CONTRIBUTING.md`, `docs/ROADMAP.md`, `docs/process/TODO.md`, `docs/TOOLING.md`, `public/llms.txt`

- [ ] **Step 1: `CONTRIBUTING.md`, "Blanks in a sentence"**

The inline-gap row of the first table becomes:

```text
| inline-gap            | `[llamo::llamarse]`, `[profesor\|maestro::trabajo]` | The answer, then optionally `::` and a hint shown in the empty box. The answer is needed. Several right answers are split by `\|`, the preferred first: none empty, none twice. |
```

After the paragraph ending "…a capital or an accent does (TODO §E35).", add:

```text
In an inline-gap, `|` means "or": `[в семейном кругу|в кругу семьи|в семье::in the family
circle]` accepts any of the three. Show answers fills in the first, and a revealed answer
lists the others under "Also accepted:". The box is as wide as the longest. `&#124;` is a
`|` the learner types, never an "or". Two answers are the same when grading would accept
both the same way: capitals count only with `caseSensitive` (TODO §E54).
```

In the message table, the `is written as a choice` row's fix becomes
"drop the `*`: the answer is typed, `[soy::ser]`", and two rows are added after
`has no answer`:

```text
| `has an empty answer`           | `[soy\|\|eres::ser]`        | remove the extra `\|`: `[soy\|eres::ser]` |
| `accepts "soy" twice`           | `[soy\|Soy::ser]`           | keep each answer once                     |
```

- [ ] **Step 2: `CONTRIBUTING.md`, "Answers in their own fields"**

The `typed-transform, conjugation, dictation` row's "Refused" cell becomes:
"an answer of spaces; an empty `\|` alternative; one accepted twice; for dictation, an
alternative of only punctuation".

Before "Repeated words are fine where real sentences repeat them…", add:

```text
A typed answer may accept more than one form: `"answer": "обеспеченные|состоятельные|богатые"`.
`|` means "or" and the first is the preferred one: Show answers fills it in, and a wrong
answer, once revealed, is shown as the form closest to the learner's with the others under
"Also accepted:". Two forms are the same when that exercise would grade them the same:
capitals fold unless `caseSensitive`, and dictation also ignores punctuation. These fields
are judged as written, so an answer here cannot hold a literal `|` (TODO §E54).
```

In the message table, add after `has no answer`:

```text
| `has an empty answer`                 | `"answer": "soy\|"`          | remove the extra `\|`                   |
| `accepts "soy" twice`                 | `"answer": "soy\|Soy"`       | keep each answer once                   |
```

- [ ] **Step 3: `docs/ROADMAP.md`, item 7**

In the **Today.** paragraph, replace

```text
A typed answer has one expected form (`answer` in
[`text-entry-schema.ts`](../src/exercises/text-entry/text-entry-schema.ts),
`[expected::hint]` in the typed gap), so `fato` and `facto` cannot both be right. Region
```

with

```text
A typed answer can accept more than one form, split by `|`, the preferred first
(`[fato|facto::hint]` in the typed gap, `"answer": "fato|facto"` in
[`text-entry-schema.ts`](../src/exercises/text-entry/text-entry-schema.ts); TODO §E54), but
every learner is offered the same forms, whatever their variety. Region
```

and in the **Typed answers that accept more than one form** bullet, "taken out of this
item and built on its own with `|`" becomes "taken out of this item and shipped on its own
with `|`".

- [ ] **Step 4: `docs/process/TODO.md`, §E54**

Insert in section E directly after the E53 item (before the E16 item):

```text
- **E54 — typed answers accept more than one form. OPEN** (branch
  `feat/typed-answer-alternatives`; spec
  [`2026-11-10-typed-answer-alternatives-design.md`](../specs/2026-11-10-typed-answer-alternatives-design.md),
  plan [`2026-11-10-typed-answer-alternatives-plan.md`](2026-11-10-typed-answer-alternatives-plan.md)).
  `|` means "or" in any typed answer, in inline-gap, typed-transform, dictation and
  conjugation; the first is preferred and Show answers fills it in. A wrong answer is
  hinted at and revealed against the closest form, and the reveal lists the others under
  "Also accepted:" (new UI string `alsoAccepted`). The build refuses an empty alternative
  and one accepted twice, compared as grading compares them; "twice" is checked on the
  exercise envelope, the only schema that sees `options.caseSensitive`. Found by the
  Russian course: lessons 3 and 4 dropped seven alternatives the 2015 units accepted;
  course PR 8 (lesson 4) waits for this. **Verify:** the gate in AGENTS.md, and
  `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e`
  (`e2e/debug/typed-answer-alternatives.spec.ts`). **Next, after merge:** a "Done
  recently" row with the merge SHA, this item marked DONE, and each course takes it with
  its next update.
```

- [ ] **Step 5: `docs/TOOLING.md`, "Browser tests"**

In the debug-suite "Covered:" sentence, after "a finished flashcards deck shows its done
card and Reset does not move;" insert: "a typed gap marks a non-preferred answer right and a
revealed miss lists the other accepted answers, axe clean (`typed-answer-alternatives`);".

- [ ] **Step 6: `public/llms.txt`**

After the engine list (the line `- Study and reading: flashcards, reading, conjugation`)
and its blank line, add:

```text
A typed answer (inline-gap, typed-transform, dictation, conjugation) may accept several
forms split by `|`, the first preferred: `[fato|facto::hint]`, `"answer": "fato|facto"`.
```

- [ ] **Step 7: Format, check links and commit**

Run: `bun run format && bun run test src/docs src/guards`
Expected: PASS (the markdown link check finds the spec and plan links; the docs
freshness tests pass).

```bash
git add CONTRIBUTING.md docs/ROADMAP.md docs/process/TODO.md docs/TOOLING.md public/llms.txt
git commit -m "docs: typed answers accept more than one form

CONTRIBUTING's blank and own-field tables, ROADMAP item 7, TODO §E54,
the debug browser suite in TOOLING and one line in llms.txt.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: the full gate

- [ ] **Step 1: The course gate (AGENTS.md)**

Run: `bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e`
Expected: all green. Watch the coverage bars: `answer-alternatives.ts` and the new
functions in `answer-checks.ts`, `parsing.ts` and `answer-feedback.ts` need ≥ 80% lines
each (their tests above cover every branch); `AnswerFeedback.tsx` ≥ 20%.

- [ ] **Step 2: The debug suite (docs/TOOLING.md, "Browser tests")**

Run: `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e`
Expected: all green, the two new tests in Chromium, Firefox and WebKit included.

- [ ] **Step 3: If `format` changed anything, commit it on its own**

```bash
git status --short
git add -u
git commit -m "chore: format

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Skip when `git status` is clean.) Then hand over to `before-pr` for the pull request.
Rebuild without `DEBUG` before any later course e2e run (`bun run build`).

---

## Self-review: spec → tasks

| Spec section                                                     | Task                            |
| ---------------------------------------------------------------- | ------------------------------- |
| §2 `\|` means "or" in all four engines, first preferred          | 1, 2, 3                         |
| §2 `\|` despite choice blanks; a pasted choice caught by `*`     | 5                               |
| §2 Show answers fills the preferred answer                       | 2, 3                            |
| §2 A revealed answer lists the others, in the course language    | 3, 7                            |
| §3 `splitAlternatives`, empty parts kept; `&#124;` is text       | 1, 2, 5                         |
| §4 any alternative correct, same mode and `caseSensitive`        | 3                               |
| §4 hint and diff against the closest, first on a tie             | 3                               |
| §4 reveal gains `alsoAccepted`, authored order, light-normalized | 3                               |
| §5 empty alternative, repeat, `*`, dictation punctuation         | 4, 5, 6                         |
| §5 "twice" case-folded unless `caseSensitive`                    | 4, 5, 6                         |
| §6 `widthCh` from the longest alternative                        | 2                               |
| §6 "Also accepted:" line, `alsoAccepted` UI string, `lang`       | 7                               |
| §6 a hint never shows alternatives                               | 3 (type and `feedbackFor` test) |
| §7 four fixtures, one item with three alternatives each          | 8, 9                            |
| §8 unit, schema, component and browser tests                     | 1–9                             |
| §9 CONTRIBUTING, ROADMAP, TODO, llms.txt (skills: not needed)    | 10                              |
| §10 rollout: template PR through the full gate                   | 11                              |

`.claude/skills/add-lo` does not describe the answer syntax (checked 2026-11-10), so per
spec §9 it is not changed.
