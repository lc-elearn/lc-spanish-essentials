# Typed answers — more than one correct answer (E54)

**Date:** 2026-11-10 · **Status:** built 2026-11-10 (TODO §E54)
**TODO:** §E54 · **Takes over:** the "typed answers that accept more than one form" bullet of
[ROADMAP item 7](../ROADMAP.md) (language varieties), which now ships on its own

## 1. Why

A typed answer has one expected form: `[expected::hint]` in an inline-gap, `answer` in a
typed-transform, dictation or conjugation row. A learner who types a different answer
that is also right is marked wrong.

The Russian course found it first. Converting the 2015 units, Richard had to drop
alternatives the original accepted: three in lesson 3 (уменьшается, добрые отношения,
обеспеченные) and four in lesson 4 (в кругу семьи, говорят тосты, состоятельные, богатые).
The two lessons even disagree: lesson 3 keeps состоятельные and refuses обеспеченные,
lesson 4 the other way round. Every language has the same need (synonyms, word order,
`fato` or `facto`), and some gaps have three or more right answers, not two.

Lesson 4 (course PR 8) is held until this ships, so its alternatives go back in.

## 2. Decisions (maintainer, 2026-11-10)

- **`|` means "or" in any typed answer**, in all four typed engines. Any number of
  alternatives; the **first is the preferred answer**.
  - inline-gap: `[в семейном кругу|в кругу семьи|в семье::in the family circle]`
  - typed-transform, dictation, conjugation: `"answer": "обеспеченные|состоятельные|богатые"`

  One rule for authors, and the JSON shape does not change (`answer` stays a string).

- **`|` despite choice blanks.** ROADMAP item 7 said the separator could not be `|`
  because choice blanks (`[a|*b|c]`) already use it. It can: each exercise type reads its
  own blanks, so the code never confuses the two, and the one real risk, a choice blank
  pasted into a typed gap, is still caught by its `*` (§5).
- **Show answers fills in the preferred answer.**
- **A revealed answer also lists the others**: under the diff line, "Also accepted:" and
  the remaining alternatives, in the course language.
- **Not changing:** capital-letter handling (`caseSensitive`), accent strictness, the
  normalizing in `answers.ts`, and the choice and drag engines.

## 3. The shared helper

`src/exercises/lib/answer-alternatives.ts`, one pure function and its tests:

```ts
/** The accepted answers in a typed answer, in authored order: split on `|`, each trimmed. */
export function splitAlternatives(answer: string): string[];
```

Nothing else in the codebase splits a typed answer on `|`. An empty part is kept (as
`''`) so the load check can name it; grading never sees one, because the build refuses it.

**A literal `|`.** In an inline-gap, `&#124;` is text, as it is in a choice blank: the
blank's `|` is read before entities are decoded (CONTRIBUTING, "Blanks in a sentence").
A table answer is judged as written, never decoded, so it cannot hold a literal `|`. No
answer in any course has one today; if one is ever needed, that is a later change.

## 4. Grading

`gradeTypedAnswers()` in `answer-feedback.ts` stays the one grader. Its `expected`
becomes one list of accepted answers per gap or row (`readonly (readonly string[])[]`);
the three engine wrappers (`inline-gap-grading.ts`, `text-entry-grading.ts`,
`conjugation-grading.ts`) pass `splitAlternatives(answer)`.

- **Correct** when `answerKey(value)` equals `answerKey` of any alternative, with the
  same mode (strict or dictation) and `caseSensitive` as today.
- **Wrong:** the hint and the revealed diff are made against the **closest** alternative:
  the highest `similarity()` on the compared keys, the first on a tie. A learner who
  types `в кругу семя` is told about the ending of в кругу семьи, not compared with в
  семейном кругу.
- **Reveal** (`kind: 'reveal'`) gains `alsoAccepted: string[]`: the other alternatives,
  in authored order, light-normalized. Empty when there is only one answer.
- **Show answers** (`inline-gap-grading.ts`, `text-entry-grading.ts`,
  `conjugation-grading.ts`) fills each gap or row with the first alternative.

## 5. Load checks

The schemas refuse an answer no learner could match, with a plain message, before any
page is written (TODO §E34, §E35, §E42).

| Fault                                                 | Message                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| an empty alternative: `[a\|\|b]`, `[a\|]`, `"a\|"`    | `has an empty answer: remove the extra \|`               |
| the same alternative twice, compared as grading does  | `accepts "x" twice: each answer must differ`             |
| a `*` in an inline-gap answer (a pasted choice blank) | `is written as a choice` (as today, now on `*` only)     |
| dictation: an alternative that is only punctuation    | `has nothing to type` (the E42 message), per alternative |

- **Inline-gap** (`inputBlankProblems` in `parsing.ts`) judges each alternative decoded,
  as the learner's answer is graded (§E35). Today's `|` test becomes the empty-answer and
  repeat tests; the `*` test stays.
- **Table engines** use a new `typedAnswerProblems(answer, normalize)` beside
  `hasTypedAnswer` in `answer-checks.ts`, judged as written (§E42). typed-transform and
  conjugation pass `normalizeAnswer`; dictation passes `normalizeForDictation`.
- "Twice" is judged case-folded unless the exercise is `caseSensitive`, because grading
  would accept both the same way.
- Conjugation's choice mode is already refused at load, so it needs no rule here.

## 6. What the learner sees

- **The box width** (`widthCh` in `parseInputBlank`) is sized to the **longest**
  alternative, so the width does not give the preferred answer away.
- **AnswerFeedback** (`src/exercises/lib/AnswerFeedback.tsx`): under a reveal with
  `alsoAccepted`, one more line: the label, then the alternatives joined with " · ", the
  alternatives in `lang={contentLang}`. The label is a new UI string, `alsoAccepted`
  ("Also accepted:"), in `src/config/ui-strings.ts`, so an exercise's `labels` can reword
  it. Tokens only; no new colour. It is part of the feedback text, so screen readers hear
  it with the answer.
- A hint (`kind: 'hint'`) never shows alternatives: the learner tries again first.

## 7. Showcase

Each of the four fixtures (`inline-gap.fixture.ts`, `typed-transform.fixture.ts`,
`dictation.fixture.ts`, `conjugation.fixture.ts`) gains one gap or row with three
alternatives, so the exercise showcase (`DEBUG=1`) shows the feature in every engine.
The fixtures are already loaded through the engine schemas, so they prove the syntax
passes the build.

## 8. Tests (written first)

- `answer-alternatives.test.ts`: one answer, several, spaces around `|`, empty parts kept.
- `answer-feedback.test.ts`: correct on any alternative; wrong answers diffed against the
  closest; tie goes to the first; `alsoAccepted` on reveal, empty for one answer;
  dictation mode and `caseSensitive` respected per alternative.
- `parsing.test.ts`, `answer-checks.test.ts` (new), each engine's schema test: the §5 faults
  and messages; `&#124;` stays text; `*` still caught.
- Each engine's grading test: Show answers fills the first alternative.
- `AnswerFeedback.test.tsx`: the "Also accepted" line, its `lang`, and its absence for
  one answer.
- Browser (`e2e/`): in the showcase, typing a non-preferred alternative in an inline-gap
  is marked correct; a wrong answer revealed shows "Also accepted"; axe stays clean.

## 9. Docs

- **CONTRIBUTING.md:** the "Blanks in a sentence" table (inline-gap row) and the error
  table (the new messages; the `is written as a choice` example), and "Answers in their
  own fields" for the table engines.
- **docs/ROADMAP.md item 7:** the bullet that said the separator cannot be `|` now says
  this shipped separately with `|`, pointing here.
- **docs/process/TODO.md:** §E54, open until merged, then into "Done recently".
- **public/llms.txt:** one line under the typing engines.
- **.claude/skills/add-lo:** only if it describes the answer syntax (it does not today).

## 10. Rollout

1. Template pull request, through the full gate (`AGENTS.md`).
2. Each course takes it with its next template sync.
3. Richard restores the dropped alternatives in Russian lessons 3 and 4, and checks
   lessons 1 and 2 against the 2015 units for any more.
4. Course PR 8 (lesson 4) merges.
