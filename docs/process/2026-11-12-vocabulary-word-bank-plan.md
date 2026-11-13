# One word bank per lesson, shown by topic and A–Z (E63) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The vocabulary block becomes a word bank: one list per lesson, each entry written and recorded once, shown as a topic view and an A–Z view (with optional letter headings), with an optional self-test that hides one side and reveals word by word.

**Architecture:** The block envelope gains a per-type `options` object, checked at load against the type's own schema (`block-options-schemas.ts`) as an exercise's options are per engine, and `LoBlock` now passes `options` and the block's existing `labels` to the renderer. The rules live in four pure modules beside the block (`vocabulary-block-schema.ts` for the six build-failing rules, `vocabulary-letters.ts`, `vocabulary-views.ts`, `vocabulary-self-test.ts`); the view is split into `VocabularyBlock.tsx` (state), `VocabularyControls.tsx` (button groups), `VocabularySections.tsx` (headings and `<dl>`s) and `VocabularyRow.tsx` (one entry, hide and reveal). Row clicks go through E62's `src/audio/row-clip.ts`.

**Tech stack:** React 19, TypeScript, Zod 4, Vitest (`node` by default, `happy-dom` opted in per file), Playwright with axe, Tailwind classes plus one small stylesheet in `@layer components`.

**Spec:** [`docs/specs/2026-11-12-vocabulary-word-bank-design.md`](../specs/2026-11-12-vocabulary-word-bank-design.md) · **Branch:** `feat/vocabulary-word-bank` (spec already committed as `d4db215`) · **Builds on:** E62, PR 114 (`src/audio/row-clip.ts`), merged to `main` 2026-11-12 20:59 UTC.

**Repo rules that apply to every task** ([`AGENTS.md`](../../AGENTS.md)): run tests with `bun run test <path>`, **never `bun test`**; a test is written first and seen failing; tests sit beside the code; no raw hex, no raw px on spacing; every CSS rule in `@layer`, no `!important`; prerendered markup equals the first client render; files under 800 lines; one concern per commit, Conventional Commits, each body ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never push to `main`.

**Every step below was run once in a prototype** (the E62 tree with these changes applied, 2026-11-12): the expected failures, the passing tests, `tsc -b`, ESLint, Stylelint, Prettier, the coverage bars, `bun run build`, the new browser spec in all three browsers (three repeats), and the whole Chromium suite. Code blocks are Prettier-formatted as shown.

**Decisions this plan makes that the spec does not** (each is recorded in the spec's new "Deviations" section in Task 13):

1. **The block's `labels` reach its renderer.** `BlockConfigSchema` has validated `labels` since the start, but `LoBlock` never passed them on, so W10's "the block's `labels` override" did nothing. `LoBlock` now passes `labels` with `options`.
2. **More `ui-strings` keys than the two hide labels.** The view buttons' words ("Semantic", "Alphabetical") were hard-coded; W10 needs them in `ui-strings`. Eight keys: `vocabularyViews`, `vocabularySemantic`, `vocabularyAlphabetical`, `vocabularySelfTest`, `vocabularyHide`, `vocabularyReveal`, `vocabularyRevealWord`, `vocabularyListenWord`. A key with `{placeholders}` refuses a rewording that drops one, as `progressCorrect` does. _Superseded: see spec §11._
3. **`{language}` is filled by a new `fillLabel(template, values)`** in `ui-strings.ts`. No key interpolated generically before (only `progressCorrect`, through its own `progressText`).
4. **Heading level follows presentation**, as the sources block's does: `<h4>` in a card (the spec's case), `<h3>` in a plain block, so the outline never skips a level (guard h).
5. **A topic without a heading is a divider (`<hr>`) except the first**, which gets nothing above it.
6. **Three more build-failing rules:** a topic `id` declared twice, a misspelt key in a topic (topics are strict objects) and an empty `topics: []`.
7. **A hidden term's `<dt>` drops `lang`.** The cell then holds English chrome (the Reveal button, the speaker's "Listen: word 3"); §6 puts `lang` on target-language text only. _Superseded: see spec §11._
8. **"word 3" is the entry's place in the current view, from 1, counted across sections.**
9. **Reversing the A–Z view is not a view switch:** what was revealed stays revealed. Only Semantic ↔ Alphabetical clears it.
10. **Letter headings:** sections are cut from the A→Z order and then reversed, so a heading reads the same both ways. The heading is the first _letter_ (a leading bracket or quote is skipped), and it shows the language's BASE letter whenever the collator treats the marked and unmarked letter as the same (all `\p{M}` marks removed then): German "Ä" heads "A", French "É" and "Ê" head "E", Russian "ё" heads "Е" (Russian dictionaries file ё under Е). Letters the language treats as distinct keep their marks: Spanish "Ñ", Russian "Й", Polish "Ó".
11. **The vocabulary item schema is strict** (maintainer decision, 2026-11-12; the plan had left it open): an unknown key on an entry (say `"onyl"`) fails the build with a message naming the entry and the key. Checked first: every vocabulary entry in the Russian course's lessons 1–4 uses only `term`, `gloss` and `audio`; no other course has lessons yet.

---

## File map

| File                                                                                                                        | Change                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lo/blocks/vocabulary-options-schema.ts`                                                                                | **new**: `VocabularyBlockOptionsSchema` (`selfTest`, `letterHeadings`), zod only |
| `src/lo/blocks/block-options-schemas.ts` (+ test)                                                                           | **new**: which block types take `options`, `blockOptionsSchema(type)`            |
| `src/config/lo-schema.ts` (+ test)                                                                                          | `BlockConfigSchema` gains `options`, checked per type in a `superRefine`         |
| `src/lo/blocks/parse-block-content.ts` (+ new test)                                                                         | `parseBlockOptions` beside `parseBlockContent`                                   |
| `src/lo/blocks/block-renderers.ts`                                                                                          | `BlockRendererProps` gains `options` and `labels`                                |
| `src/lo/LoBlock.tsx` (+ test)                                                                                               | passes `options` and `labels` to the renderer                                    |
| `src/lib/lang.ts` (+ test)                                                                                                  | `NATIVE_LANG`, `languageName`, `TARGET_LANGUAGE_NAME`, `NATIVE_LANGUAGE_NAME`    |
| `src/exercises/flashcards/FlashcardsExercise.tsx`                                                                           | uses the shared names; its own `Intl.DisplayNames` goes                          |
| `src/config/ui-strings.ts` (+ test)                                                                                         | eight `vocabulary*` keys, `labelWith`, `fillLabel`                               |
| `src/lo/blocks/vocabulary-block-schema.ts` (+ new test)                                                                     | `topics`, `topic`, `only`, and the build-failing rules                           |
| `src/lo/blocks/vocabulary-letters.ts` (+ test)                                                                              | **new**: `firstLetter`, `headingLetter`, `letterSections`, `VocabularySection`   |
| `src/lo/blocks/vocabulary-views.ts` (+ test)                                                                                | **new**: which entries each view shows, topic and A–Z sections                   |
| `src/lo/blocks/vocabulary-self-test.ts` (+ test)                                                                            | **new**: the self-test reducer                                                   |
| `src/lo/blocks/VocabularyBlock.tsx` (+ tests)                                                                               | holds state only; renders controls and sections                                  |
| `src/lo/blocks/VocabularyControls.tsx`                                                                                      | **new**: `ViewButtons`, `SelfTestButtons`                                        |
| `src/lo/blocks/VocabularySections.tsx`                                                                                      | **new**: headings, dividers, one `<dl>` per section                              |
| `src/lo/blocks/VocabularyRow.tsx`                                                                                           | **new**: one entry (moved out of `VocabularyBlock.tsx`), hide and reveal         |
| `src/lo/blocks/vocabulary-block.css` (+ test)                                                                               | **new**: the letter heading's two rules, in `@layer components`                  |
| `src/lo/blocks/VocabularyBlock.word-bank.test.tsx`                                                                          | **new**: mounted tests (happy-dom): letters, self-test                           |
| `lo-config/lo-00-example/blocks/02-vocabulary/block.json`                                                                   | topics, `only`, `selfTest`, `letterHeadings`                                     |
| `e2e/vocabulary-word-bank.spec.ts`                                                                                          | **new**: the keyboard drill and axe with words hidden                            |
| `CONTRIBUTING.md`, `.claude/skills/add-lo/SKILL.md`, `public/llms.txt`, `docs/TOOLING.md`, `docs/process/TODO.md`, the spec | docs                                                                             |

`VocabularyBlock.tsx` ends near 120 lines and the largest new file (`VocabularyRow.tsx`) near 140, all well under 800.

---

### Task 0: Start from `main` with E62 in it

PR 114 merged on 2026-11-12 (rebase-merged, so E62's commits have new SHAs on `main`). This branch was cut before it and holds only docs commits (the spec, then this plan), so a rebase replays them cleanly.

- [ ] **Step 1: Confirm PR 114 is merged.**
      Run: `gh pr view 114 --json state,mergedAt`
      Expected: `{"mergedAt":"2026-11-12T20:59:36Z","state":"MERGED"}`. If it says `OPEN`, stop: nothing below can start.

- [ ] **Step 2: Commit this plan if it is not yet committed, then rebase.**

```bash
git status --short          # this plan must be committed first (docs: plan … (E63))
git fetch origin
git switch feat/vocabulary-word-bank
git rebase origin/main
```

Expected: `Successfully rebased and updated refs/heads/feat/vocabulary-word-bank.` If the rebase stops on a conflict (only possible if someone else edited this spec), `git rebase --abort`, then recreate the branch: `git switch -c feat/vocabulary-word-bank-2 origin/main && git cherry-pick d4db215 <plan commit>`, and carry on there.

- [ ] **Step 3: Confirm the helper is there and the vocabulary block uses it.**

```bash
grep -n "^export" src/audio/row-clip.ts
grep -n "row-clip" src/lo/blocks/VocabularyBlock.tsx
bun run test src/lo/blocks
```

Expected: `ROW_CLIP_SPEAKER_ATTRIBUTE`, `ROW_CLIP_ROW_SELECTOR`, `ROW_CLIP_CLASSES`, `shouldPlayRowClip`, `playRowClip`; `import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';`; all tests PASS (including `VocabularyBlock.row-clip.test.tsx`).

---

### Task 1: The block envelope takes per-type `options`

**Files:**

- Create: `src/lo/blocks/vocabulary-options-schema.ts`, `src/lo/blocks/block-options-schemas.ts`, `src/lo/blocks/block-options-schemas.test.ts`, `src/lo/blocks/parse-block-content.test.ts`
- Modify: `src/config/lo-schema.ts` (imports; `BlockConfigSchema`, lines 100–135), `src/config/lo-schema.test.ts` (append), `src/lo/blocks/parse-block-content.ts`, `src/lo/blocks/block-renderers.ts` (lines 18–35)

- [ ] **Step 1: Write the failing tests.** Append to `src/config/lo-schema.test.ts` (it already imports `test`, `expect`, `z` and `BlockConfigSchema`):

```ts
// E63 (spec §3): a block may carry `options`, checked per block type as an exercise's
// are per engine. Only `vocabulary` takes any today.
test('BlockConfigSchema: a vocabulary block accepts its two options', () => {
  const parsed = BlockConfigSchema.parse({
    type: 'vocabulary',
    title: 'Vocabulary',
    options: { selfTest: true, letterHeadings: true },
    content: {},
  });
  expect(parsed.options).toEqual({ selfTest: true, letterHeadings: true });
});

test('BlockConfigSchema: a block without options still parses, options undefined', () => {
  expect(BlockConfigSchema.parse({ type: 'vocabulary', title: 'V', content: {} }).options).toBe(
    undefined,
  );
});

test('BlockConfigSchema: an unknown vocabulary option fails, naming the key', () => {
  const result = BlockConfigSchema.safeParse({
    type: 'vocabulary',
    title: 'V',
    options: { selfTset: true },
    content: {},
  });
  expect(result.success).toBe(false);
  expect(z.prettifyError(result.error as z.ZodError)).toMatch(/selfTset[\s\S]*options/);
});

test('BlockConfigSchema: a vocabulary option of the wrong type fails', () => {
  expect(
    BlockConfigSchema.safeParse({
      type: 'vocabulary',
      title: 'V',
      options: { letterHeadings: 'yes' },
      content: {},
    }).success,
  ).toBe(false);
});

test('BlockConfigSchema: a block type with no options refuses an options object', () => {
  const result = BlockConfigSchema.safeParse({
    type: 'prose',
    title: 'P',
    options: {},
    content: {},
  });
  expect(result.success).toBe(false);
  expect(z.prettifyError(result.error as z.ZodError)).toContain('A prose block takes no options');
});
```

Create `src/lo/blocks/parse-block-content.test.ts`:

```ts
/**
 * parse-block-content.test.ts — a block's content and options are checked against its
 * own schema, and a failure names the block type and what broke (E63 adds options).
 */
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { parseBlockContent, parseBlockOptions } from './parse-block-content';

const Options = z.strictObject({ selfTest: z.boolean().default(false) });

describe('parseBlockContent', () => {
  test('returns the parsed content', () => {
    expect(parseBlockContent('x', z.object({ a: z.string() }), { a: 'b' })).toEqual({ a: 'b' });
  });

  test('throws naming the type', () => {
    expect(() => parseBlockContent('x', z.object({ a: z.string() }), {})).toThrow(
      /block type "x" has invalid content/,
    );
  });
});

describe('parseBlockOptions', () => {
  test('absent options take every default', () => {
    expect(parseBlockOptions('vocabulary', Options, undefined)).toEqual({ selfTest: false });
  });

  test('given options are parsed', () => {
    expect(parseBlockOptions('vocabulary', Options, { selfTest: true })).toEqual({
      selfTest: true,
    });
  });

  test('a bad option throws naming the type and the key', () => {
    expect(() => parseBlockOptions('vocabulary', Options, { selfTset: true })).toThrow(
      /block type "vocabulary" has invalid options[\s\S]*selfTset/,
    );
  });
});
```

Create `src/lo/blocks/block-options-schemas.test.ts`:

```ts
/**
 * block-options-schemas.test.ts — which block types take `options` (E63).
 */
import { expect, test } from 'vitest';
import { blockOptionsSchema } from './block-options-schemas';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';

test('vocabulary takes options; other types and prototype keys do not', () => {
  expect(blockOptionsSchema('vocabulary')).toBe(VocabularyBlockOptionsSchema);
  expect(blockOptionsSchema('prose')).toBeUndefined();
  expect(blockOptionsSchema('toString')).toBeUndefined();
});

test('the vocabulary options default off and refuse unknown keys', () => {
  expect(VocabularyBlockOptionsSchema.parse({})).toEqual({
    selfTest: false,
    letterHeadings: false,
  });
  expect(VocabularyBlockOptionsSchema.safeParse({ sort: false }).success).toBe(false);
});
```

- [ ] **Step 2: Run them and see them fail.**
      Run: `bun run test src/config/lo-schema.test.ts src/lo/blocks/parse-block-content.test.ts src/lo/blocks/block-options-schemas.test.ts`
      Expected: FAIL. In `lo-schema.test.ts` four of the five new tests fail (`options` is stripped today, so `parsed.options` is `undefined` and nothing is refused); "a block without options still parses" passes. The three `parseBlockOptions` tests fail with `parseBlockOptions is not a function`. `block-options-schemas.test.ts` fails: cannot find `./block-options-schemas`.

- [ ] **Step 3: Write the two schema modules.** Create `src/lo/blocks/vocabulary-options-schema.ts`:

```ts
/**
 * vocabulary-options-schema.ts — the vocabulary block's `options` (E63, spec §3):
 * switches that change how the word bank is shown, never what it holds. Both default
 * off, so a block without `options`, as every course has today, renders as before (W3).
 *
 * Its own file, with zod as its only import: `lo-schema.ts` reaches it through
 * `block-options-schemas.ts`, and the envelope's imports stay relative and light.
 */
import { z } from 'zod';

export const VocabularyBlockOptionsSchema = z.strictObject({
  /** Hide {language} / Hide English buttons, and a Reveal button per hidden word. */
  selfTest: z.boolean().default(false),
  /** Letter headings in the A–Z view, from the course language's collation. */
  letterHeadings: z.boolean().default(false),
});
export type VocabularyBlockOptions = z.infer<typeof VocabularyBlockOptionsSchema>;
```

Create `src/lo/blocks/block-options-schemas.ts`:

```ts
/**
 * block-options-schemas.ts — which block types take `options`, and the schema each
 * one's are checked against (E63). The block-side twin of `exercise-schemas.ts`: a block
 * type absent here takes no options, and `BlockConfigSchema` refuses any it is given.
 *
 * Relative imports only: `lo-schema.ts` imports this file (AGENTS.md, hard constraint 1).
 */
import type { z } from 'zod';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';

const BLOCK_OPTIONS_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  vocabulary: VocabularyBlockOptionsSchema,
};

/** The options schema for a block `type`, or `undefined` if that type takes none. */
export function blockOptionsSchema(type: string): z.ZodType | undefined {
  // Own keys only: `toString` is not a block type.
  return Object.hasOwn(BLOCK_OPTIONS_SCHEMAS, type) ? BLOCK_OPTIONS_SCHEMAS[type] : undefined;
}
```

- [ ] **Step 4: Check `options` in the envelope.** In `src/config/lo-schema.ts`:
  1. After `import { SetTabMediaSchema } from '../lo/blocks/media-schema';` add (relative, like every import in this file):

```ts
import { blockOptionsSchema } from '../lo/blocks/block-options-schemas';
```

2. In `BlockConfigSchema`'s object, replace `labels: UiStringsOverrideSchema.optional(),` and the `content` line after it with:

```ts
    labels: UiStringsOverrideSchema.optional(),
    /**
     * Per-type switches (E63, spec §3). Loose here, as `content` is; the superRefine
     * below checks them against the type's own schema (`block-options-schemas.ts`), so
     * an unknown key or a type that takes no options fails at load, naming the file.
     */
    options: z.looseObject({}).optional(),
    content: z.looseObject({}),
```

3. Replace the last refine (the `defaultOpen` one, ending `});` before `export type BlockConfig`) with:

```ts
  .refine((block) => block.presentation !== 'plain' || block.defaultOpen !== true, {
    path: ['defaultOpen'],
    message: 'A plain block has no accordion to open — remove `defaultOpen`.',
  })
  // E63: options are checked per block type, as an exercise's are per engine. The
  // renderer re-parses them for their defaults (`parseBlockOptions`).
  .superRefine((block, ctx) => {
    if (block.options === undefined) return;
    const schema = blockOptionsSchema(block.type);
    if (schema === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `A ${block.type} block takes no options — remove \`options\`.`,
      });
      return;
    }
    const result = schema.safeParse(block.options);
    if (result.success) return;
    result.error.issues.forEach((issue) =>
      ctx.addIssue({ code: 'custom', path: ['options', ...issue.path], message: issue.message }),
    );
  });
```

- [ ] **Step 5: Add `parseBlockOptions`.** Append to `src/lo/blocks/parse-block-content.ts`:

```ts
/**
 * Parse `options` for a block of `type` (E63), or throw naming the type and what broke.
 * Absent options parse as `{}`, so every default applies. The envelope has already
 * refused bad options at load; this is where the renderer gets their defaults.
 */
export function parseBlockOptions<TSchema extends z.ZodTypeAny>(
  type: string,
  schema: TSchema,
  options: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(options ?? {});
  if (!result.success) {
    throw new Error(`block type "${type}" has invalid options:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
```

- [ ] **Step 6: Widen the renderer props.** In `src/lo/blocks/block-renderers.ts`, add `import type { UiStringsOverride } from '@/config/ui-strings';` after the `BlockConfig` import, and replace the `BlockRendererProps` doc comment and interface with:

```ts
/**
 * Props every block renderer receives: the block's raw, type-specific `content`, and
 * its `presentation`. Most renderers ignore the latter; a renderer with its own
 * headings needs it, because a plain block sits under the section's <h2> and a card
 * under the accordion's <h3>.
 *
 * `options` (E63) are the block's raw per-type switches, already checked at load by
 * `BlockConfigSchema`; the renderer re-parses them for their defaults
 * (`parseBlockOptions`). `labels` is the block's override of the UI strings.
 */
export interface BlockRendererProps {
  content: unknown;
  presentation?: BlockConfig['presentation'];
  options?: unknown;
  labels?: UiStringsOverride;
}
```

(`LoBlock` starts passing them in Task 8, where a test proves it.)

- [ ] **Step 7: Run the tests again.** Same command as Step 2, then `bun run test src/config src/lo`.
      Expected: PASS. `example-lo.test.ts` still parses every example `block.json` (none has `options` yet).

- [ ] **Step 8: Commit.**

```bash
git add src/lo/blocks/vocabulary-options-schema.ts src/lo/blocks/block-options-schemas.ts src/lo/blocks/block-options-schemas.test.ts src/config/lo-schema.ts src/config/lo-schema.test.ts src/lo/blocks/parse-block-content.ts src/lo/blocks/parse-block-content.test.ts src/lo/blocks/block-renderers.ts
git commit -m "feat(blocks): a block may carry options, checked per block type (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One way to name a language

**Files:**

- Modify: `src/lib/lang.ts`, `src/lib/lang.test.ts`, `src/exercises/flashcards/FlashcardsExercise.tsx` (the `@/lib/lang` import; lines 73–78)

- [ ] **Step 1: Write the failing tests.** In `src/lib/lang.test.ts`, replace `import { TARGET_LANG } from './lang';` with:

```ts
import {
  languageName,
  NATIVE_LANG,
  NATIVE_LANGUAGE_NAME,
  TARGET_LANG,
  TARGET_LANGUAGE_NAME,
} from './lang';
```

and append:

```ts
// E63: the vocabulary block's "Hide {language}" and flashcards' face labels share one
// way of naming a language, in English (the UI language).
test('languageName gives the English name of a language code', () => {
  expect(languageName('ru')).toBe('Russian');
  expect(languageName('es')).toBe('Spanish');
  expect(languageName('en')).toBe('English');
});

test('languageName falls back to the code itself when Intl cannot name it', () => {
  expect(languageName('1x')).toBe('1x');
});

test('the course and learner language names follow the codes', () => {
  expect(TARGET_LANGUAGE_NAME).toBe(languageName(TARGET_LANG));
  expect(NATIVE_LANG).toBe('en');
  expect(NATIVE_LANGUAGE_NAME).toBe('English');
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/lib/lang.test.ts`
      Expected: FAIL, 3 tests, `TypeError: languageName is not a function`.

- [ ] **Step 3: Add the names.** Append to `src/lib/lang.ts` (keep its relative import of `course.config`):

```ts
/** The learner's own language, which is also the UI language (`<html lang="en">`). */
export const NATIVE_LANG = 'en';

const LANGUAGE_NAMES = new Intl.DisplayNames([NATIVE_LANG], { type: 'language' });

/**
 * A language's name in English, the UI language: "ru" → "Russian" (E63, spec §5).
 * One lookup for every label that names a language: the vocabulary block's "Hide
 * Russian" and flashcards' "Russian to English". Falls back to the code itself, and
 * never throws: `Intl.DisplayNames` throws on a malformed code, and this module is
 * imported by every page.
 */
export function languageName(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The course language's English name, e.g. "Spanish". */
export const TARGET_LANGUAGE_NAME = languageName(TARGET_LANG);
/** The learner's language's English name: "English". */
export const NATIVE_LANGUAGE_NAME = languageName(NATIVE_LANG);
```

- [ ] **Step 4: Flashcards uses them.** In `src/exercises/flashcards/FlashcardsExercise.tsx`, replace `import { TARGET_LANG } from '@/lib/lang';` with:

```ts
import {
  NATIVE_LANGUAGE_NAME as NATIVE_NAME,
  TARGET_LANG,
  TARGET_LANGUAGE_NAME as TARGET_NAME,
} from '@/lib/lang';
```

and delete these six lines (just above `/** Let the next front turn into view … */`):

```ts
/** The learner's own language; the deck's `native` side. */
const NATIVE_LANG = 'en';
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
/** Face and direction labels, e.g. "Spanish" / "English", from the language code. */
const TARGET_NAME = languageNames.of(TARGET_LANG) ?? TARGET_LANG;
const NATIVE_NAME = languageNames.of(NATIVE_LANG) ?? NATIVE_LANG;
```

The aliases keep every other line of the file unchanged.

- [ ] **Step 5: Run lang and flashcards.**
      Run: `bun run test src/lib/lang.test.ts src/exercises/flashcards`
      Expected: PASS (flashcards still says "Spanish to English").

- [ ] **Step 6: Commit.**

```bash
git add src/lib/lang.ts src/lib/lang.test.ts src/exercises/flashcards/FlashcardsExercise.tsx
git commit -m "refactor(lang): name a language in one place, shared with flashcards (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The vocabulary block's words in `ui-strings`

**Files:**

- Modify: `src/config/ui-strings.ts`, `src/config/ui-strings.test.ts`

- [ ] **Step 1: Write the failing tests.** In `src/config/ui-strings.test.ts`, replace the `./ui-strings` import with:

```ts
import {
  fillLabel,
  uiStrings,
  UiStringsSchema,
  UiStringsOverrideSchema,
  resolveLabel,
} from './ui-strings';
```

and append:

```ts
// E63 (spec §4–5, W10): the vocabulary block's chrome. The view buttons keep today's
// words, so a course that changes nothing sees no change.
test('ui-strings: the vocabulary block labels exist, view buttons as today', () => {
  expect(resolveLabel('vocabularyViews')).toBe('Choose a view');
  expect(resolveLabel('vocabularySemantic')).toBe('Semantic');
  expect(resolveLabel('vocabularyAlphabetical')).toBe('Alphabetical');
  expect(resolveLabel('vocabularySelfTest')).toBe('Test yourself');
  expect(resolveLabel('vocabularyHide')).toBe('Hide {language}');
  expect(resolveLabel('vocabularyReveal')).toBe('Reveal');
  expect(resolveLabel('vocabularyRevealWord')).toBe('Reveal {language}, word {number}');
  expect(resolveLabel('vocabularyListenWord')).toBe('Listen: word {number}');
});

test('ui-strings: a block can rename the view buttons', () => {
  expect(resolveLabel('vocabularySemantic', { vocabularySemantic: 'By topic' })).toBe('By topic');
});

// A rewording that drops a placeholder would name no language or no word.
test.each([
  ['vocabularyHide', 'Hide it'],
  ['vocabularyRevealWord', 'Reveal {language}'],
  ['vocabularyRevealWord', 'Reveal word {number}'],
  ['vocabularyListenWord', 'Listen'],
])('ui-strings: %s without its placeholders is rejected (%s)', (key, value) => {
  expect(UiStringsOverrideSchema.safeParse({ [key]: value }).success).toBe(false);
});

test('ui-strings: a rewording that keeps its placeholders is accepted', () => {
  expect(
    UiStringsOverrideSchema.safeParse({
      vocabularyHide: 'Cover the {language}',
      vocabularyRevealWord: 'Show {language} word {number}',
      vocabularyListenWord: 'Hear word {number}',
    }).success,
  ).toBe(true);
});

test('fillLabel fills every named placeholder, and leaves others alone', () => {
  expect(fillLabel('Hide {language}', { language: 'Russian' })).toBe('Hide Russian');
  expect(fillLabel('Reveal {language}, word {number}', { language: 'Russian', number: 3 })).toBe(
    'Reveal Russian, word 3',
  );
  expect(fillLabel('{a} and {a}', { a: 'x' })).toBe('x and x');
  expect(fillLabel('Hide {language}', {})).toBe('Hide {language}');
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/config/ui-strings.test.ts`
      Expected: FAIL: "the vocabulary block labels exist" (`expected undefined to be 'Choose a view'`), "a rewording that keeps its placeholders is accepted" (the keys are unknown, so refused), and "fillLabel" (`fillLabel is not a function`). The four "rejected" cases and the "rename" case already pass, for the wrong reason (unknown keys); they pin the behaviour once the keys exist.

- [ ] **Step 3: Add the keys and `fillLabel`.** In `src/config/ui-strings.ts`:
  1. Above the `/** The key set. … */` comment, add:

```ts
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
```

2. In `UiStringsSchema`, after `credits: z.string().min(1),` add:

```ts
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
  vocabularyListenWord: labelWith('number'),
```

3. In `raw`, after `credits: 'Credits',` add:

```ts
  vocabularyViews: 'Choose a view',
  vocabularySemantic: 'Semantic',
  vocabularyAlphabetical: 'Alphabetical',
  vocabularySelfTest: 'Test yourself',
  vocabularyHide: 'Hide {language}',
  vocabularyReveal: 'Reveal',
  vocabularyRevealWord: 'Reveal {language}, word {number}',
  vocabularyListenWord: 'Listen: word {number}',
```

4. Append at the end of the file:

```ts
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
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/config/ui-strings.ts src/config/ui-strings.test.ts
git commit -m "feat(ui-strings): the vocabulary block's view and self-test labels (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The word bank's content rules

**Files:**

- Modify: `src/lo/blocks/vocabulary-block-schema.ts`
- Create: `src/lo/blocks/vocabulary-block-schema.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `src/lo/blocks/vocabulary-block-schema.test.ts`:

```ts
/**
 * vocabulary-block-schema.test.ts — the word bank's content contract (E63, spec §3):
 * one list of entries, each in the topic view, the A–Z view or both, and the six ways
 * a word bank fails the build, each with a message naming the entry.
 */
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { VocabularyBlockContentSchema } from './vocabulary-block-schema';

const TOPICS = [{ id: 'marriage', heading: 'Marriage' }, { id: 'attitudes' }];

/** The parse error as an author reads it, or '' when the content is valid. */
function errorFor(content: unknown): string {
  const result = VocabularyBlockContentSchema.safeParse(content);
  return result.success ? '' : z.prettifyError(result.error);
}

describe('valid word banks', () => {
  test('a plain list, as every course has today, still parses', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage' }] })).toBe('');
  });

  test('topics, topic and only parse', () => {
    const parsed = VocabularyBlockContentSchema.parse({
      topics: TOPICS,
      items: [
        { term: 'брак', gloss: 'marriage', topic: 'marriage' },
        { term: 'гражда́нский брак', gloss: 'civil partnership', topic: 'marriage', only: 'topics' },
        { term: 'гражда́нский', gloss: 'civil', only: 'alphabetical' },
        { term: 'развод', gloss: 'divorce', topic: 'attitudes' },
      ],
    });
    expect(parsed.topics).toEqual(TOPICS);
    expect(parsed.items.map((item) => item.only)).toEqual([
      undefined,
      'topics',
      'alphabetical',
      undefined,
    ]);
  });

  test('without topics, an entry needs no topic', () => {
    expect(
      errorFor({
        items: [
          { term: 'брак', gloss: 'marriage', only: 'topics' },
          { term: 'гражданский', gloss: 'civil', only: 'alphabetical' },
        ],
      }),
    ).toBe('');
  });
});

describe('the build fails on', () => {
  test('1. a topic not declared in topics', () => {
    expect(
      errorFor({
        topics: TOPICS,
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marrige' },
          { term: 'развод', gloss: 'divorce', topic: 'attitudes' },
          { term: 'жена', gloss: 'wife', topic: 'marriage' },
        ],
      }),
    ).toMatch(
      /items\[0\] "брак": topic "marrige" is not declared in "topics" \(declared: marriage, attitudes\)/,
    );
  });

  test('1. a topic when no topics are declared at all', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }] })).toMatch(
      /items\[0\] "брак": topic "marriage" is not declared in "topics"/,
    );
  });

  test('2. topics declared and a topic-view entry with no topic', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }],
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marriage' },
          { term: 'жена', gloss: 'wife' },
        ],
      }),
    ).toMatch(/items\[1\] "жена" shows in the topic view but has no "topic"/);
  });

  test('2. …but an A–Z-only entry needs none', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }],
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marriage' },
          { term: 'жена', gloss: 'wife', only: 'alphabetical' },
        ],
      }),
    ).toBe('');
  });

  test('3. a declared topic no entry uses', () => {
    expect(
      errorFor({ topics: TOPICS, items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }] }),
    ).toMatch(/topic "attitudes" is declared but no entry uses it/);
  });

  test('4. a topic together with "only": "alphabetical"', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }],
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marriage' },
          { term: 'жена', gloss: 'wife', topic: 'marriage', only: 'alphabetical' },
        ],
      }),
    ).toMatch(/items\[1\] "жена" has a topic but "only": "alphabetical"/);
  });

  test('5. the same term twice, compared after Unicode normalisation', () => {
    // "й" written precomposed (U+0439), then as и + combining breve (U+0438 U+0306).
    expect(
      errorFor({
        items: [
          { term: 'мой', gloss: 'my' },
          { term: 'мой', gloss: 'mine' },
        ],
      }),
    ).toMatch(/items\[1\] "мой" repeats items\[0\]/);
  });

  test('6. an only value other than "topics" or "alphabetical"', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage', only: 'semantic' }] })).toMatch(
      /items\[0\]\.only/,
    );
  });

  test('a topic id declared twice', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }, { id: 'marriage' }],
        items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }],
      }),
    ).toMatch(/topic "marriage" is declared twice/);
  });

  test('a misspelt key in a topic', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage', haeding: 'Marriage' }],
        items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }],
      }),
    ).toMatch(/haeding/);
  });
});
```

(Rule 6's other half, an unknown key in `options`, is Task 1's.)

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/lo/blocks/vocabulary-block-schema.test.ts`
      Expected: FAIL, 10 of 13. The three that pass already: "a plain list", "without topics, an entry needs no topic" and "…but an A–Z-only entry needs none" (today's schema strips `topic`, `only` and `topics`).

- [ ] **Step 3: Write the rules.** Replace the whole of `src/lo/blocks/vocabulary-block-schema.ts` with:

```ts
/**
 * vocabulary-block-schema.ts — the per-type `content` contract for
 * `type: "vocabulary"`, mirroring the per-engine `*-schema.ts` convention.
 *
 * A WORD BANK (E63, spec docs/specs/2026-11-12-vocabulary-word-bank-design.md §3): one
 * list, each entry written once, shown two ways. `topics` groups the topic view;
 * `only` keeps an entry to one view (a phrase to the topics, a headword to A–Z). The
 * cross-entry rules are one superRefine at the end, each message naming the entry.
 */
import { z } from 'zod';
import { parseRichText } from '../rich-text/parse-rich-text';

export const VocabularyItemSchema = z.object({
  /** The target-language word or phrase. */
  term: z.string().min(1),
  /** Its UI-language gloss. */
  gloss: z.string().min(1),
  /**
   * Optional clip of the TERM being said, rendered as a speaker button beside it.
   *
   * Optional because a vocabulary list is useful without audio and a course may not
   * have recordings yet — a required field would make every clone record audio before
   * it could ship a word list. `audio` is a key guard d already sweeps, so a path
   * pointing at a file that is not there fails the build rather than going silent in
   * the browser.
   */
  audio: z.string().min(1).optional(),
  /** The `id` of a declared topic: the group this entry sits in, in the topic view. */
  topic: z.string().min(1).optional(),
  /** The one view this entry shows in. Absent means both. */
  only: z.enum(['topics', 'alphabetical']).optional(),
});
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;

/**
 * An info alert above the list (maintainer, 2026-10-08, after french-lo-1): a lead
 * line ("You will learn:") and a ticked list. Both are INLINE RICH TEXT, like the
 * outcomes block's, so a summary can italicise the words it previews.
 */
export const VocabularySummarySchema = z.object({
  lead: z
    .string()
    .min(1)
    .transform((value) => parseRichText(value)),
  items: z
    .array(z.string().min(1))
    .min(1)
    .transform((entries) => entries.map((entry) => parseRichText(entry))),
});

/** One group of the topic view. Without a `heading` it renders as a divider. */
export const VocabularyTopicSchema = z.strictObject({
  id: z.string().min(1),
  heading: z.string().min(1).optional(),
});
export type VocabularyTopic = z.infer<typeof VocabularyTopicSchema>;

const VocabularyBlockContentShape = z.object({
  /** Accordion-level instructions, rendered by LoAccordion's one instructions slot. */
  instructions: z.string().min(1).optional(),
  summary: VocabularySummarySchema.optional(),
  /** The topic view's groups, in display order. Absent: one flat list, as before E63. */
  topics: z.array(VocabularyTopicSchema).min(1).optional(),
  items: z.array(VocabularyItemSchema).min(1),
});

/** How a message names an entry: `items[3] "брак"`. */
const entryName = (index: number, term: string): string =>
  `items[${index}] "${term.normalize('NFC')}"`;

/** Rules 1–4 (spec §3) for one entry, given the declared topic ids. */
function checkEntryTopic(
  item: VocabularyItem,
  index: number,
  declared: readonly string[] | undefined,
  ctx: z.RefinementCtx,
): void {
  const name = entryName(index, item.term);
  const path = ['items', index, 'topic'];
  if (item.topic !== undefined && item.only === 'alphabetical') {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `${name} has a topic but "only": "alphabetical", so the topic would never show — remove one`,
    });
  } else if (item.topic !== undefined && !(declared ?? []).includes(item.topic)) {
    const known = declared === undefined ? 'none' : declared.join(', ');
    ctx.addIssue({
      code: 'custom',
      path,
      message: `${name}: topic "${item.topic}" is not declared in "topics" (declared: ${known})`,
    });
  } else if (item.topic === undefined && declared !== undefined && item.only !== 'alphabetical') {
    ctx.addIssue({
      code: 'custom',
      path: ['items', index],
      message: `${name} shows in the topic view but has no "topic" — give it one, or "only": "alphabetical"`,
    });
  }
}

/** The word bank's cross-entry rules (spec §3, 1–5; rule 6 is the enum and the options). */
function checkWordBank(
  content: z.output<typeof VocabularyBlockContentShape>,
  ctx: z.RefinementCtx,
): void {
  const declared = content.topics?.map((topic) => topic.id);
  declared?.forEach((id, index) => {
    if (declared.indexOf(id) !== index) {
      ctx.addIssue({
        code: 'custom',
        path: ['topics', index, 'id'],
        message: `topic "${id}" is declared twice`,
      });
    }
    if (!content.items.some((item) => item.topic === id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['topics', index],
        message: `topic "${id}" is declared but no entry uses it`,
      });
    }
  });
  const firstIndex = new Map<string, number>();
  content.items.forEach((item, index) => {
    checkEntryTopic(item, index, declared, ctx);
    const key = item.term.normalize('NFC');
    const first = firstIndex.get(key);
    if (first === undefined) {
      firstIndex.set(key, index);
      return;
    }
    ctx.addIssue({
      code: 'custom',
      path: ['items', index, 'term'],
      message: `${entryName(index, item.term)} repeats items[${first}] — write each word once; "only" says which view it shows in`,
    });
  });
}

export const VocabularyBlockContentSchema = VocabularyBlockContentShape.superRefine(checkWordBank);
export type VocabularyBlockContent = z.infer<typeof VocabularyBlockContentSchema>;
```

**How these fail the build.** Block content is not parsed by the loader (only the envelope is; see `assemble-lo.ts`): the renderer parses it, so the prerender in `bun run build` throws, and the dev page shows the error. The message names the block type and the entry, e.g. `block type "vocabulary" has invalid content: ✖ items[2] "…": topic "group-tow" is not declared in "topics" (declared: group-one, group-two)` (checked in the prototype with `bun scripts/prerender.tsx`).

- [ ] **Step 4: Run it again, and the block's other tests.**
      Run: `bun run test src/lo/blocks`
      Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lo/blocks/vocabulary-block-schema.ts src/lo/blocks/vocabulary-block-schema.test.ts
git commit -m "feat(vocabulary): topics, topic and only, and the rules that fail the build (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Letter sections, per language

**Files:**

- Create: `src/lo/blocks/vocabulary-letters.ts`, `src/lo/blocks/vocabulary-letters.test.ts`

**What the collator says** (run 2026-11-12 with Bun 1.3.1 and Node 22.19, identical): `new Intl.Collator(lang, { sensitivity: 'base' }).compare(a, b)` gives `ru` ё/е **0** (same letter), Ё/е **0**, й/и **1** (different), `fr` é/e **0**, `es` ñ/n **1** and ñ/o **−1** (its own letter, between n and o), `de` ä/a **0**, `pl` ó/o **1**, and `ru` "безнра́вственный"/"безнравственный" **0** (the stress mark ignored). Sorted at base sensitivity: `ru` [аист, безнра́вственный, брак, еда, ёлка, жена, игра, иметь, йод]; `es` [nada, nube, ñandú, oso]; `fr` [eau, école, être, fin]; `de` [Affe, apfel, Ärger, bauen]. The tests below pin these.

- [ ] **Step 1: Write the failing tests.** Create `src/lo/blocks/vocabulary-letters.test.ts`:

```ts
/**
 * vocabulary-letters.test.ts — letter headings for the A–Z view (E63, spec §4, W6).
 * Which letters share a heading is the course language's collation, at `base`
 * sensitivity: these tests PIN what the collator decides (verified with Node 22 and
 * Bun 1.3, 2026-11-12), they do not choose it. If an ICU update changes a result, the
 * test says so, and that is a decision for the maintainer, not a fix in the code.
 */
import { describe, expect, test } from 'vitest';
import { sortVocabulary } from './vocabulary-sort';
import { firstLetter, headingLetter, letterSections } from './vocabulary-letters';

/** Sections of `terms` sorted A–Z in `lang`, as [heading, terms] pairs. */
function sectionsOf(lang: string, terms: readonly string[]): [string | undefined, string[]][] {
  const sorted = sortVocabulary(
    terms.map((term) => ({ term })),
    'alphabetical',
    lang,
  );
  return letterSections(sorted, lang).map((section) => [
    section.heading,
    section.items.map((item) => item.term),
  ]);
}

describe('firstLetter', () => {
  test('is the first letter with its marks, skipping anything that is not a letter', () => {
    expect(firstLetter('о́чень')).toBe('о́');
    expect(firstLetter('(с) кем')).toBe('с');
    expect(firstLetter('ёлка')).toBe('ё');
  });
});

describe('headingLetter', () => {
  test('ru: a stress mark is removed, and the letter upper-cased', () => {
    expect(headingLetter('безнра́вственный', 'ru')).toBe('Б');
    expect(headingLetter('о́чень', 'ru')).toBe('О');
  });

  test('ru: ё and й keep their own marks', () => {
    expect(headingLetter('ёлка', 'ru')).toBe('Ё');
    expect(headingLetter('йод', 'ru')).toBe('Й');
  });

  test('fr: an accent the collation ignores is dropped from the heading', () => {
    expect(headingLetter('école', 'fr')).toBe('E');
  });

  test('es: ñ is a letter of its own, so it stays', () => {
    expect(headingLetter('ñandú', 'es')).toBe('Ñ');
  });

  test('pl: ó is a letter of its own in Polish, so the acute stays', () => {
    expect(headingLetter('ósmy', 'pl')).toBe('Ó');
  });
});

describe('letterSections', () => {
  test('ru: stress is ignored, ё sorts and groups with е, й is its own letter', () => {
    expect(
      sectionsOf('ru', ['ёлка', 'еда', 'йод', 'игра', 'безнра́вственный', 'брак', 'аист']),
    ).toEqual([
      ['А', ['аист']],
      ['Б', ['безнра́вственный', 'брак']],
      ['Е', ['еда', 'ёлка']],
      ['И', ['игра']],
      ['Й', ['йод']],
    ]);
  });

  test('ru: a section of ё words alone is headed Ё', () => {
    expect(sectionsOf('ru', ['ёж', 'жена'])).toEqual([
      ['Ё', ['ёж']],
      ['Ж', ['жена']],
    ]);
  });

  test('fr: é sorts and groups under E', () => {
    expect(sectionsOf('fr', ['fin', 'école', 'eau', 'être'])).toEqual([
      ['E', ['eau', 'école', 'être']],
      ['F', ['fin']],
    ]);
  });

  test('es: ñ is its own letter, after N', () => {
    expect(sectionsOf('es', ['oso', 'ñandú', 'nube', 'nada'])).toEqual([
      ['N', ['nada', 'nube']],
      ['Ñ', ['ñandú']],
      ['O', ['oso']],
    ]);
  });

  test('de: ä sorts and groups under A', () => {
    expect(sectionsOf('de', ['bauen', 'Ärger', 'apfel', 'Affe'])).toEqual([
      ['A', ['Affe', 'apfel', 'Ärger']],
      ['B', ['bauen']],
    ]);
  });

  test('every section has a distinct key', () => {
    const sorted = sortVocabulary(
      ['b', 'a', 'c'].map((term) => ({ term })),
      'alphabetical',
      'en',
    );
    const keys = letterSections(sorted, 'en').map((section) => section.key);
    expect(new Set(keys).size).toBe(3);
  });

  test('no entries, no sections', () => {
    expect(letterSections([], 'ru')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/lo/blocks/vocabulary-letters.test.ts`
      Expected: FAIL, `Cannot find module './vocabulary-letters'`.

- [ ] **Step 3: Write the module.** Create `src/lo/blocks/vocabulary-letters.ts`:

```ts
/**
 * vocabulary-letters.ts — letter headings for the vocabulary block's A–Z view (E63,
 * spec §4, W6). Pure, so the per-language rules are tested here, not through a view.
 *
 * WHICH LETTERS SHARE A HEADING IS THE COLLATOR'S DECISION, never "first character,
 * upper-cased". A new section starts wherever an entry's first letter compares unequal
 * (`Intl.Collator`, `base` sensitivity, the course language) to the previous entry's.
 * So Russian ё joins е and й stands alone, French é joins e, Spanish ñ stands alone
 * after n, German ä joins a — whatever the language's collation says (the tests pin it).
 *
 * The HEADING is the section's first letter, upper-cased for the course language, with
 * a stress mark (U+0301 acute, U+0300 grave) removed only where the collator says the
 * marked and unmarked letters are the same letter: Russian "о́" heads "О", French "é"
 * heads "E", but Polish "ó", a letter of its own, stays "Ó".
 */

/** One run of entries under an optional heading: a topic, or a letter. */
export interface VocabularySection<T> {
  /** Stable and unique within one list: the React key. */
  readonly key: string;
  readonly heading?: string;
  readonly items: readonly T[];
}

const STRESS_MARKS = /[̀́]/gu;

/**
 * The first letter of a term with its combining marks, composed (NFC). Anything before
 * it that is not a letter (a bracket, a quote) is skipped: "(с) кем" → "с".
 */
export function firstLetter(term: string): string {
  const decomposed = term.normalize('NFD');
  const letter = /\p{L}\p{M}*/u.exec(decomposed)?.[0] ?? Array.from(decomposed)[0] ?? '';
  return letter.normalize('NFC');
}

/** The heading a section starting with `term` shows, in `lang`. */
export function headingLetter(term: string, lang: string): string {
  const letter = firstLetter(term);
  const unstressed = letter.normalize('NFD').replace(STRESS_MARKS, '').normalize('NFC');
  const sameLetter =
    new Intl.Collator(lang, { sensitivity: 'base' }).compare(letter, unstressed) === 0;
  return (sameLetter ? unstressed : letter).toLocaleUpperCase(lang);
}

/**
 * Splits a list ALREADY SORTED A→Z into letter sections. A reversed view reverses the
 * sections this returns (vocabulary-views.ts), so a heading is the same both ways.
 */
export function letterSections<T extends { readonly term: string }>(
  sorted: readonly T[],
  lang: string,
): VocabularySection<T>[] {
  const collator = new Intl.Collator(lang, { sensitivity: 'base' });
  return sorted.reduce<VocabularySection<T>[]>((sections, item, index) => {
    const previous = sorted[index - 1];
    const last = sections.at(-1);
    const sameLetter =
      previous !== undefined &&
      collator.compare(firstLetter(previous.term), firstLetter(item.term)) === 0;
    if (sameLetter && last !== undefined) {
      return [...sections.slice(0, -1), { ...last, items: [...last.items, item] }];
    }
    const heading = headingLetter(item.term, lang);
    return [...sections, { key: `letter-${sections.length}-${heading}`, heading, items: [item] }];
  }, []);
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS, 13 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lo/blocks/vocabulary-letters.ts src/lo/blocks/vocabulary-letters.test.ts
git commit -m "feat(vocabulary): letter sections from the course language's collation (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Which entries each view shows

**Files:**

- Create: `src/lo/blocks/vocabulary-views.ts`, `src/lo/blocks/vocabulary-views.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `src/lo/blocks/vocabulary-views.test.ts`:

```ts
/**
 * vocabulary-views.test.ts — which entries each of the word bank's two views shows,
 * and in what order (E63, spec §4). The topic view is the authored order, grouped by
 * `topics`; the A–Z view sorts in the course language and a second press reverses it.
 */
import { describe, expect, test } from 'vitest';
import {
  alphabeticalSections,
  entriesInView,
  offersBothViews,
  sectionsFor,
  topicSections,
  viewFor,
  type WordBankEntry,
} from './vocabulary-views';

const BANK: WordBankEntry[] = [
  { term: 'брак', topic: 'marriage' },
  { term: 'гражда́нский брак', topic: 'marriage', only: 'topics' },
  { term: 'развод', topic: 'attitudes' },
  { term: 'гражда́нский', only: 'alphabetical' },
  { term: 'жена', topic: 'marriage' },
];
const TOPICS = [{ id: 'marriage', heading: 'Marriage' }, { id: 'attitudes' }];

const terms = (list: readonly { term: string }[]) => list.map((item) => item.term);
const shape = (sections: readonly { heading?: string; items: readonly { term: string }[] }[]) =>
  sections.map((section) => [section.heading, terms(section.items)]);

describe('entriesInView', () => {
  test('the topic view leaves out A–Z-only entries, in written order', () => {
    expect(terms(entriesInView(BANK, 'topics'))).toEqual([
      'брак',
      'гражда́нский брак',
      'развод',
      'жена',
    ]);
  });

  test('the A–Z view leaves out topic-only entries', () => {
    expect(terms(entriesInView(BANK, 'alphabetical'))).toEqual([
      'брак',
      'развод',
      'гражда́нский',
      'жена',
    ]);
  });
});

describe('topicSections', () => {
  test('one section per topic, in topics order, entries in written order', () => {
    expect(shape(topicSections(BANK, TOPICS))).toEqual([
      ['Marriage', ['брак', 'гражда́нский брак', 'жена']],
      [undefined, ['развод']],
    ]);
  });

  test('without topics, one flat list in written order, as before E63', () => {
    expect(shape(topicSections(BANK, undefined))).toEqual([
      [undefined, ['брак', 'гражда́нский брак', 'развод', 'жена']],
    ]);
  });
});

describe('alphabeticalSections', () => {
  test('sorted in the course language, ignoring the stress mark', () => {
    expect(shape(alphabeticalSections(BANK, 'alphabetical', 'ru', false))).toEqual([
      [undefined, ['брак', 'гражда́нский', 'жена', 'развод']],
    ]);
  });

  test('reverse is the same list backwards', () => {
    expect(shape(alphabeticalSections(BANK, 'reverse', 'ru', false))).toEqual([
      [undefined, ['развод', 'жена', 'гражда́нский', 'брак']],
    ]);
  });

  test('with letter headings', () => {
    expect(shape(alphabeticalSections(BANK, 'alphabetical', 'ru', true))).toEqual([
      ['Б', ['брак']],
      ['Г', ['гражда́нский']],
      ['Ж', ['жена']],
      ['Р', ['развод']],
    ]);
  });

  test('letter headings reverse with the list, and keep their letters', () => {
    const bank = [{ term: 'еда' }, { term: 'ёлка' }, { term: 'брак' }];
    expect(shape(alphabeticalSections(bank, 'reverse', 'ru', true))).toEqual([
      ['Е', ['ёлка', 'еда']],
      ['Б', ['брак']],
    ]);
  });
});

describe('viewFor and offersBothViews', () => {
  test('Semantic shows the topic view, Alphabetical and its reverse the A–Z view', () => {
    expect(viewFor('semantic', BANK)).toBe('topics');
    expect(viewFor('alphabetical', BANK)).toBe('alphabetical');
    expect(viewFor('reverse', BANK)).toBe('alphabetical');
    expect(offersBothViews(BANK)).toBe(true);
  });

  test('a view with no entries is never shown, and the buttons go', () => {
    const azOnly: WordBankEntry[] = [
      { term: 'a', only: 'alphabetical' },
      { term: 'b', only: 'alphabetical' },
    ];
    const topicsOnly: WordBankEntry[] = [
      { term: 'a', only: 'topics' },
      { term: 'b', only: 'topics' },
    ];
    expect(viewFor('semantic', azOnly)).toBe('alphabetical');
    expect(viewFor('alphabetical', topicsOnly)).toBe('topics');
    expect(offersBothViews(azOnly)).toBe(false);
    expect(offersBothViews(topicsOnly)).toBe(false);
  });

  test('one entry offers no buttons, as before E63', () => {
    expect(offersBothViews([{ term: 'a' }])).toBe(false);
  });
});

describe('sectionsFor', () => {
  test('the topic view, then the A–Z view, from the sort mode', () => {
    const settings = { topics: TOPICS, lang: 'ru', letterHeadings: false };
    expect(sectionsFor(BANK, { ...settings, mode: 'semantic' }).view).toBe('topics');
    expect(shape(sectionsFor(BANK, { ...settings, mode: 'reverse' }).sections)).toEqual([
      [undefined, ['развод', 'жена', 'гражда́нский', 'брак']],
    ]);
  });

  test('an A–Z-only bank shows A→Z even on the semantic mode', () => {
    const azOnly: WordBankEntry[] = [
      { term: 'b', only: 'alphabetical' },
      { term: 'a', only: 'alphabetical' },
    ];
    const result = sectionsFor(azOnly, { mode: 'semantic', lang: 'en', letterHeadings: false });
    expect(result.view).toBe('alphabetical');
    expect(shape(result.sections)).toEqual([[undefined, ['a', 'b']]]);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/lo/blocks/vocabulary-views.test.ts`
      Expected: FAIL, `Cannot find module './vocabulary-views'`.

- [ ] **Step 3: Write the module.** Create `src/lo/blocks/vocabulary-views.ts`:

```ts
/**
 * vocabulary-views.ts — the word bank's two views (E63, spec §4). Pure, so which entry
 * shows where, and in what order, is tested here and the view stays thin.
 *
 *   - topics        the authored order, grouped by `topics` when the block declares
 *                   them; entries marked `"only": "alphabetical"` are left out.
 *   - alphabetical  sorted in the course language (vocabulary-sort.ts), optionally under
 *                   letter headings (vocabulary-letters.ts); entries marked
 *                   `"only": "topics"` are left out. The `reverse` sort mode shows it Z→A.
 *
 * A view with no entries is never shown: the other one is, and the buttons are not
 * offered (`offersBothViews`).
 */
import { letterSections, type VocabularySection } from './vocabulary-letters';
import { sortVocabulary, type VocabularySortMode } from './vocabulary-sort';

export type VocabularyView = 'topics' | 'alphabetical';

/** What the views need from an entry: the schema's item, narrowed. */
export interface WordBankEntry {
  readonly term: string;
  readonly topic?: string;
  readonly only?: VocabularyView;
}

/** What the views need from a topic. */
export interface WordBankTopic {
  readonly id: string;
  readonly heading?: string;
}

/** The entries `view` shows, in written order. */
export function entriesInView<T extends WordBankEntry>(
  items: readonly T[],
  view: VocabularyView,
): T[] {
  return items.filter((item) => item.only === undefined || item.only === view);
}

/** Whether to offer the view buttons: two or more entries, and both views have some. */
export function offersBothViews(items: readonly WordBankEntry[]): boolean {
  return (
    items.length >= 2 &&
    entriesInView(items, 'topics').length > 0 &&
    entriesInView(items, 'alphabetical').length > 0
  );
}

/** The view a sort mode shows; when one view would be empty, always the other. */
export function viewFor(mode: VocabularySortMode, items: readonly WordBankEntry[]): VocabularyView {
  if (entriesInView(items, 'topics').length === 0) return 'alphabetical';
  if (entriesInView(items, 'alphabetical').length === 0) return 'topics';
  return mode === 'semantic' ? 'topics' : 'alphabetical';
}

/** The topic view: one section per topic, or one flat section without `topics`. */
export function topicSections<T extends WordBankEntry>(
  items: readonly T[],
  topics: readonly WordBankTopic[] | undefined,
): VocabularySection<T>[] {
  const shown = entriesInView(items, 'topics');
  if (topics === undefined) return [{ key: 'all', items: shown }];
  return topics.map((topic) => ({
    key: `topic-${topic.id}`,
    ...(topic.heading === undefined ? {} : { heading: topic.heading }),
    items: shown.filter((item) => item.topic === topic.id),
  }));
}

/**
 * The A–Z view. Sections are cut from the A→Z order and then reversed, entries and
 * sections both, so a letter heading reads the same in either direction.
 */
export function alphabeticalSections<T extends WordBankEntry>(
  items: readonly T[],
  order: 'alphabetical' | 'reverse',
  lang: string,
  letterHeadings: boolean,
): VocabularySection<T>[] {
  const sorted = sortVocabulary(entriesInView(items, 'alphabetical'), 'alphabetical', lang);
  const sections = letterHeadings ? letterSections(sorted, lang) : [{ key: 'all', items: sorted }];
  if (order === 'alphabetical') return sections;
  return [...sections].reverse().map((section) => ({
    ...section,
    items: [...section.items].reverse(),
  }));
}

export interface ViewSettings {
  readonly mode: VocabularySortMode;
  readonly topics?: readonly WordBankTopic[];
  readonly lang: string;
  readonly letterHeadings: boolean;
}

/** The view to show for `settings`, and its sections. */
export function sectionsFor<T extends WordBankEntry>(
  items: readonly T[],
  settings: ViewSettings,
): { view: VocabularyView; sections: VocabularySection<T>[] } {
  const view = viewFor(settings.mode, items);
  if (view === 'topics') return { view, sections: topicSections(items, settings.topics) };
  const order = settings.mode === 'reverse' ? 'reverse' : 'alphabetical';
  return {
    view,
    sections: alphabeticalSections(items, order, settings.lang, settings.letterHeadings),
  };
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS, 13 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lo/blocks/vocabulary-views.ts src/lo/blocks/vocabulary-views.test.ts
git commit -m "feat(vocabulary): the topic and A–Z views of a word bank (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The self-test reducer

**Files:**

- Create: `src/lo/blocks/vocabulary-self-test.ts`, `src/lo/blocks/vocabulary-self-test.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `src/lo/blocks/vocabulary-self-test.test.ts`:

```ts
/**
 * vocabulary-self-test.test.ts — the word bank's self-test (E63, spec §5, W7): hide one
 * side, recall, reveal word by word. Either/or: hiding one side shows the other.
 */
import { describe, expect, test } from 'vitest';
import {
  INITIAL_SELF_TEST,
  isAnyHidden,
  isHidden,
  selfTestReducer,
  type SelfTestAction,
  type SelfTestState,
} from './vocabulary-self-test';

const run = (...actions: SelfTestAction[]): SelfTestState =>
  actions.reduce(selfTestReducer, INITIAL_SELF_TEST);

describe('selfTestReducer', () => {
  test('starts with nothing hidden, so the prerender is unchanged', () => {
    expect(INITIAL_SELF_TEST).toEqual({ hidden: 'none', revealed: [], lastRevealed: null });
  });

  test('hide hides one side', () => {
    const state = run({ type: 'hide', side: 'target' });
    expect(isHidden(state, 'брак', 'target')).toBe(true);
    expect(isHidden(state, 'брак', 'native')).toBe(false);
  });

  test('either/or: hiding the other side releases the first', () => {
    const state = run({ type: 'hide', side: 'target' }, { type: 'hide', side: 'native' });
    expect(state.hidden).toBe('native');
    expect(isHidden(state, 'брак', 'target')).toBe(false);
  });

  test('reveal shows one word and remembers it as the one to focus', () => {
    const state = run({ type: 'hide', side: 'target' }, { type: 'reveal', term: 'брак' });
    expect(isHidden(state, 'брак', 'target')).toBe(false);
    expect(isHidden(state, 'жена', 'target')).toBe(true);
    expect(state.lastRevealed).toBe('брак');
  });

  test('reveal does nothing when nothing is hidden, or twice', () => {
    expect(run({ type: 'reveal', term: 'брак' })).toEqual(INITIAL_SELF_TEST);
    const once = run({ type: 'hide', side: 'target' }, { type: 'reveal', term: 'брак' });
    expect(selfTestReducer(once, { type: 'reveal', term: 'брак' })).toBe(once);
  });

  test('switching view keeps the hidden side and clears what was revealed', () => {
    const state = run(
      { type: 'hide', side: 'native' },
      { type: 'reveal', term: 'брак' },
      { type: 'switch-view' },
    );
    expect(state).toEqual({ hidden: 'native', revealed: [], lastRevealed: null });
  });

  test('pressing the pressed button again releases it and shows everything', () => {
    const state = run(
      { type: 'hide', side: 'target' },
      { type: 'reveal', term: 'брак' },
      { type: 'hide', side: 'target' },
    );
    expect(state).toEqual(INITIAL_SELF_TEST);
  });

  test('never changes the state it was given', () => {
    const before = run({ type: 'hide', side: 'target' });
    const copy = structuredClone(before);
    selfTestReducer(before, { type: 'reveal', term: 'брак' });
    expect(before).toEqual(copy);
  });
});

describe('isAnyHidden', () => {
  test('false with nothing hidden, true while one word is, false once all are revealed', () => {
    const shown = ['брак', 'жена'];
    expect(isAnyHidden(INITIAL_SELF_TEST, shown)).toBe(false);
    const hidden = run({ type: 'hide', side: 'target' }, { type: 'reveal', term: 'брак' });
    expect(isAnyHidden(hidden, shown)).toBe(true);
    expect(isAnyHidden(selfTestReducer(hidden, { type: 'reveal', term: 'жена' }), shown)).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/lo/blocks/vocabulary-self-test.test.ts`
      Expected: FAIL, `Cannot find module './vocabulary-self-test'`.

- [ ] **Step 3: Write the reducer.** Create `src/lo/blocks/vocabulary-self-test.ts`:

```ts
/**
 * vocabulary-self-test.ts — the word bank's self-test as one pure reducer (E63, spec §5).
 * The view holds only `useReducer(selfTestReducer, INITIAL_SELF_TEST)`.
 *
 * Either/or (W7): `hidden` is one side or none, so hiding one side shows the other.
 * Words are revealed one by one, by term (terms are unique in a block, schema rule 5).
 * `lastRevealed` is the word the view moves focus to. Switching view keeps the hidden
 * side and forgets what was revealed; pressing the pressed button again shows all.
 *
 * Initial state hides nothing, so the prerendered markup equals the first client render.
 */

/** Which side of every entry a hide button covers: the course language, or English. */
export type HideSide = 'target' | 'native';

export interface SelfTestState {
  readonly hidden: HideSide | 'none';
  /** Terms revealed since the side was hidden or the view switched. */
  readonly revealed: readonly string[];
  /** The term revealed last, which takes focus; null when there is none. */
  readonly lastRevealed: string | null;
}

export type SelfTestAction =
  | { readonly type: 'hide'; readonly side: HideSide }
  | { readonly type: 'reveal'; readonly term: string }
  | { readonly type: 'switch-view' };

export const INITIAL_SELF_TEST: SelfTestState = {
  hidden: 'none',
  revealed: [],
  lastRevealed: null,
};

export function selfTestReducer(state: SelfTestState, action: SelfTestAction): SelfTestState {
  switch (action.type) {
    case 'hide':
      return {
        hidden: state.hidden === action.side ? 'none' : action.side,
        revealed: [],
        lastRevealed: null,
      };
    case 'reveal':
      if (state.hidden === 'none' || state.revealed.includes(action.term)) return state;
      return {
        ...state,
        revealed: [...state.revealed, action.term],
        lastRevealed: action.term,
      };
    case 'switch-view':
      return { ...state, revealed: [], lastRevealed: null };
  }
}

/** Whether `side` of the entry `term` is hidden now. */
export function isHidden(state: SelfTestState, term: string, side: HideSide): boolean {
  return state.hidden === side && !state.revealed.includes(term);
}

/** Whether any of `terms` (the entries shown) has a side hidden: row clicks stop (W8). */
export function isAnyHidden(state: SelfTestState, terms: readonly string[]): boolean {
  return state.hidden !== 'none' && terms.some((term) => !state.revealed.includes(term));
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS, 9 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lo/blocks/vocabulary-self-test.ts src/lo/blocks/vocabulary-self-test.test.ts
git commit -m "feat(vocabulary): the self-test reducer, hide one side and reveal word by word (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The topic view, and options and labels reach the block

The block's view is split into four files now, so each stays small: `VocabularyBlock.tsx` keeps the state, `VocabularyControls.tsx` the buttons, `VocabularySections.tsx` the headings and `<dl>`s, `VocabularyRow.tsx` one entry (moved unchanged out of `VocabularyBlock.tsx`, E62's row click with it). Tasks 9 and 10 grow them.

**Files:**

- Create: `src/lo/blocks/VocabularyControls.tsx`, `src/lo/blocks/VocabularySections.tsx`, `src/lo/blocks/VocabularyRow.tsx`
- Modify: `src/lo/blocks/VocabularyBlock.tsx` (whole file), `src/lo/blocks/VocabularyBlock.test.tsx`, `src/lo/LoBlock.tsx` (`blockBody`), `src/lo/LoBlock.test.tsx`

- [ ] **Step 1: Write the failing tests.** In `src/lo/blocks/VocabularyBlock.test.tsx`, change the group name in the two existing sort tests (spec §4 names the group "Choose a view"):
  - `expect(html).toContain('role="group" aria-label="Sort the vocabulary"');` → `expect(html).toContain('role="group" aria-label="Choose a view"');`
  - `expect(html).not.toContain('Sort the vocabulary');` → `expect(html).not.toContain('Choose a view');`

  Then append:

```tsx
// E63 (spec §3–4): a word bank. The first render is the topic view with nothing
// hidden, so the prerendered markup equals the first client render.
const BANK = {
  topics: [{ id: 'greetings', heading: 'Greetings' }, { id: 'farewells' }],
  items: [
    { term: 'hola', gloss: 'hello', topic: 'greetings' },
    { term: 'buenos días', gloss: 'good morning', topic: 'greetings', only: 'topics' },
    { term: 'adiós', gloss: 'goodbye', topic: 'farewells' },
    { term: 'saludar', gloss: 'to greet', only: 'alphabetical' },
  ],
};

describe('vocabulary word bank, first render', () => {
  test('is the topic view: topic entries in written order, A–Z-only entries left out', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} />);
    expect(html.indexOf('hola')).toBeLessThan(html.indexOf('buenos días'));
    expect(html.indexOf('buenos días')).toBeLessThan(html.indexOf('adiós'));
    expect(html).not.toContain('saludar');
  });

  test('heads each topic with an <h4> inside a card, and gives each topic its own <dl>', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} />);
    expect(html).toMatch(/<h4[^>]*>Greetings<\/h4>/);
    expect((html.match(/<dl/g) ?? []).length).toBe(2);
  });

  test('heads each topic with an <h3> in a plain block, under the section <h2>', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} presentation="plain" />);
    expect(html).toMatch(/<h3[^>]*>Greetings<\/h3>/);
    expect(html).not.toContain('<h4');
  });

  test('a topic without a heading is a divider', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} />);
    expect((html.match(/<hr/g) ?? []).length).toBe(1);
    expect(html.indexOf('<hr')).toBeLessThan(html.indexOf('adiós'));
  });

  test('a list without topics is still one <dl>, as before', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={{ items }} />);
    expect(html).toContain('<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">');
    expect((html.match(/<dl/g) ?? []).length).toBe(1);
    expect(html).not.toContain('<h4');
  });

  test('no view buttons when one view would be empty', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock
        content={{
          items: [
            { term: 'b', gloss: 'b', only: 'alphabetical' },
            { term: 'a', gloss: 'a', only: 'alphabetical' },
          ],
        }}
      />,
    );
    expect(html).not.toContain('Choose a view');
    // The one view with entries shows: A–Z.
    expect(html.indexOf('>a<')).toBeLessThan(html.indexOf('>b<'));
  });

  test('a block renames the view buttons through its labels', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock content={BANK} labels={{ vocabularySemantic: 'By topic' }} />,
    );
    expect(html).toContain('By topic');
    expect(html).not.toContain('Semantic');
  });
});
```

In `src/lo/LoBlock.test.tsx`, add before the test "says so visibly when a block type has no renderer":

```tsx
// E63: the renderer gets the block's labels override (Task 10 adds its options).
it("passes a block's labels to its renderer", () => {
  const html = render({
    type: 'vocabulary',
    title: 'Words',
    labels: { vocabularySemantic: 'By topic' },
    content: {
      items: [
        { term: 'hola', gloss: 'hello' },
        { term: 'adiós', gloss: 'goodbye' },
      ],
    },
  });
  expect(html).toContain('By topic');
});
```

- [ ] **Step 2: Run them and see them fail.**
      Run: `bun run test src/lo/blocks/VocabularyBlock.test.tsx src/lo/LoBlock.test.tsx`
      Expected: FAIL: the renamed "offers Semantic and Alphabetical…" test (`Sort the vocabulary` is still the name), "is the topic view", the `<h4>`, `<h3>` and divider tests, "no view buttons when one view would be empty" (the order is b, a), "renames the view buttons", and the LoBlock test. "a list without topics is still one `<dl>`" passes already: that is the point of it.

- [ ] **Step 3: Pass `options` and `labels` on.** In `src/lo/LoBlock.tsx`, replace the last line of `blockBody` (`return <Renderer content={config.content} presentation={config.presentation} />;`) with:

```tsx
return (
  <Renderer
    content={config.content}
    presentation={config.presentation}
    options={config.options}
    labels={config.labels}
  />
);
```

- [ ] **Step 4: Create `src/lo/blocks/VocabularyRow.tsx`** (today's row, moved; Task 10 adds hide and reveal):

```tsx
/**
 * VocabularyRow — one entry of the vocabulary block: the term, in the course language,
 * with its clip, and its gloss (E63 moves it out of VocabularyBlock.tsx unchanged).
 *
 * The speaker sits inside the `<dt>` and BEFORE the word. Inside, because a control in
 * a column of its own is separated from the thing it plays for anyone navigating by
 * element. Before, because it gives every row one shared left edge to scan down and
 * click, and because a vocabulary list is heard before it is read.
 */
import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';
import { AudioClip } from '@/components/audio/AudioClip';
import { TARGET_LANG } from '@/lib/lang';
import type { VocabularyItem } from './vocabulary-block-schema';

export interface VocabularyRowProps {
  item: VocabularyItem;
}

export function VocabularyRow({ item }: VocabularyRowProps) {
  const plays = item.audio !== undefined;
  return (
    // THE WHOLE ROW PLAYS THE CLIP, and it is a MOUSE affordance only — no role, no
    // tabIndex, no key handler: the speaker inside is the keyboard path (E62). Only a
    // row WITH a clip gets the cursor and the hover: a pointer over a row that does
    // nothing is a promise the page cannot keep.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- pointer-only enhancement (mouse and touch) over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
    <div
      onClick={plays ? playRowClip : undefined}
      data-row-clip={plays ? '' : undefined}
      className={`grid gap-x-6 rounded-md sm:col-span-2 sm:grid-cols-subgrid ${
        plays ? ROW_CLIP_CLASSES : ''
      }`}
    >
      <dt lang={TARGET_LANG} className="flex items-center gap-2 font-medium text-foreground">
        {item.audio === undefined ? null : (
          // `title` is the speaker's accessible name: "play" alone would be the same on
          // every row of the list.
          <AudioClip
            className="super-compact-speaker"
            inline
            soundFile={item.audio}
            title={`Listen: ${item.term}`}
          />
        )}
        {item.term}
      </dt>
      {/* Centred like the term, which sits beside a 54px speaker. */}
      <dd className="self-center text-muted-foreground">{item.gloss}</dd>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/lo/blocks/VocabularySections.tsx`:**

```tsx
/**
 * VocabularySections — the vocabulary block's list (E63, spec §4): one `<dl>` per
 * topic or letter, each under its heading. A topic without a heading is a divider
 * (none above the first). A list with one section and no heading is today's single
 * `<dl>`, unchanged (W3).
 *
 * HEADING LEVEL FOLLOWS PRESENTATION, as in the sources block: `<h3>` in a plain block,
 * under the section's `<h2>`; `<h4>` in a card, under the accordion's `<h3>`.
 *
 * The sections share one two-column grid (subgrid), so the terms line up across topics
 * and letters as they did in one list.
 */
import type { VocabularyItem } from './vocabulary-block-schema';
import type { VocabularySection } from './vocabulary-letters';
import { VocabularyRow } from './VocabularyRow';

/** Two columns from `sm`, the term's as wide as the longest term: today's list. */
const LIST = 'grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]';
/** The same columns around sections, with more room between them. */
const SECTIONS = 'grid gap-x-6 gap-y-4 sm:grid-cols-[max-content_1fr]';
const HEADING = 'font-heading text-lg font-semibold text-foreground sm:col-span-2';

interface VocabularySectionsProps {
  sections: readonly VocabularySection<VocabularyItem>[];
  headingLevel: 'h3' | 'h4';
}

export function VocabularySections({ sections, headingLevel: Heading }: VocabularySectionsProps) {
  const rows = (section: VocabularySection<VocabularyItem>) =>
    section.items.map((item) => <VocabularyRow key={item.term} item={item} />);

  const [first] = sections;
  if (sections.length === 1 && first !== undefined && first.heading === undefined) {
    return <dl className={LIST}>{rows(first)}</dl>;
  }
  return (
    <div className={SECTIONS}>
      {sections.map((section, index) => (
        <div key={section.key} className="grid gap-y-2 sm:col-span-2 sm:grid-cols-subgrid">
          {section.heading === undefined ? (
            index === 0 ? null : (
              <hr className="border-border sm:col-span-2" />
            )
          ) : (
            <Heading className={HEADING}>{section.heading}</Heading>
          )}
          <dl className="grid gap-y-2 sm:col-span-2 sm:grid-cols-subgrid">{rows(section)}</dl>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/lo/blocks/VocabularyControls.tsx`** (the view buttons; Task 10 adds the self-test's):

```tsx
/**
 * VocabularyControls — the vocabulary block's button groups (E63, spec §4–5). Every
 * button is a toggle with `aria-pressed` and a name that never changes; the pressed
 * one is filled.
 *
 * Native buttons styled by buttonVariants: the Button component would pull Base UI's
 * primitive into main-*.js, over the JS budget (docs/TOOLING.md).
 */
import { ArrowDownAZ, ArrowUpZA, Layers } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import type { VocabularySortMode } from './vocabulary-sort';

const toggleClass = (pressed: boolean): string =>
  buttonVariants({ variant: pressed ? 'default' : 'outline', size: 'lg' });

interface ViewButtonsProps {
  sortMode: VocabularySortMode;
  labels?: UiStringsOverride;
  onChoose: (pressed: 'semantic' | 'alphabetical') => void;
}

/**
 * Semantic | Alphabetical (french-lo-1's PhraseTable). A second press of Alphabetical
 * reverses the order (Z→A).
 */
export function ViewButtons({ sortMode, labels, onChoose }: ViewButtonsProps) {
  const isAlphabetical = sortMode !== 'semantic';
  const AlphabeticalIcon = sortMode === 'reverse' ? ArrowUpZA : ArrowDownAZ;
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={resolveLabel('vocabularyViews', labels)}
    >
      <button
        type="button"
        className={toggleClass(!isAlphabetical)}
        aria-pressed={!isAlphabetical}
        onClick={() => onChoose('semantic')}
      >
        <Layers aria-hidden="true" />
        {resolveLabel('vocabularySemantic', labels)}
      </button>
      <button
        type="button"
        className={toggleClass(isAlphabetical)}
        aria-pressed={isAlphabetical}
        onClick={() => onChoose('alphabetical')}
      >
        <AlphabeticalIcon aria-hidden="true" />
        {resolveLabel('vocabularyAlphabetical', labels)}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Replace the whole of `src/lo/blocks/VocabularyBlock.tsx`:**

```tsx
/**
 * VocabularyBlock — `type: "vocabulary"`. A term/gloss list, rendered as `<dl>`s: the
 * description-list element IS the semantic for "term and its definition", so no `<ul>`
 * of `<span>` pairs.
 *
 * `lang` (spec §3, WCAG 3.1.2) is per-part, not per-block: the TERM is target
 * language, its GLOSS is the UI language, so only the `<dt>` carries TARGET_LANG.
 *
 * A WORD BANK (E63, docs/specs/2026-11-12-vocabulary-word-bank-design.md). One list per
 * lesson, each word written and recorded once, shown two ways: the topic view (the
 * authored order, grouped by `topics`) and the A–Z view (the course language's order).
 * Everything new is off by default: a block with only `items` renders as before (W3).
 *
 * This file holds the state; the list is VocabularySections and VocabularyRow, the
 * buttons VocabularyControls, and the rules are pure modules beside them
 * (vocabulary-views, -letters, -self-test), each with its own tests.
 */
import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import Callout from '@/components/shell/Callout';
import { TARGET_LANG } from '@/lib/lang';
import { RichText } from '../rich-text/RichText';
import type { BlockRendererProps } from './block-renderers';
import { parseBlockContent } from './parse-block-content';
import { VocabularyBlockContentSchema } from './vocabulary-block-schema';
import { nextSortMode, type VocabularySortMode } from './vocabulary-sort';
import { offersBothViews, sectionsFor } from './vocabulary-views';
import { ViewButtons } from './VocabularyControls';
import { VocabularySections } from './VocabularySections';

export function VocabularyBlock({ content, labels, presentation = 'card' }: BlockRendererProps) {
  const { items, summary, topics } = parseBlockContent(
    'vocabulary',
    VocabularyBlockContentSchema,
    content,
  );
  // The topic view on the first render: the prerendered markup and the first client
  // render agree. The learner changes it with the buttons.
  const [sortMode, setSortMode] = useState<VocabularySortMode>('semantic');
  const { sections } = sectionsFor(items, {
    mode: sortMode,
    topics,
    lang: TARGET_LANG,
    letterHeadings: false,
  });

  return (
    <div className="grid gap-6">
      {summary === undefined ? null : (
        // No top margin: the accordion body's own pt-2 gives the 8px this alert once
        // carried (LoAccordion, maintainer 2026-10-08).
        <Callout variant="info" title={<RichText nodes={summary.lead} />}>
          {/* The outcomes block's ticked list: semantics from <ul>/<li>, ticks aria-hidden. */}
          <ul className="mt-3 grid gap-2">
            {summary.items.map((item, index) => (
              // Static config, never reordered: the index is a stable key.
              <li key={index} className="flex items-start gap-2">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0">
                  <RichText nodes={item} />
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {offersBothViews(items) ? (
        <ViewButtons
          sortMode={sortMode}
          labels={labels}
          onChoose={(pressed) => setSortMode((mode) => nextSortMode(mode, pressed))}
        />
      ) : null}

      <VocabularySections
        sections={sections}
        headingLevel={presentation === 'plain' ? 'h3' : 'h4'}
      />
    </div>
  );
}
```

`vocabulary-sort.ts` keeps `sortVocabulary` (the views use it) and `nextSortMode`; nothing there changes.

- [ ] **Step 8: Run the block, page and guard tests.**
      Run: `bun run test src/lo src/guards`
      Expected: PASS, including `VocabularyBlock.row-clip.test.tsx` (E62), `block-renderers.test.tsx` (the `<dt lang>`, the speaker before the word, `cursor-pointer` only with a clip) and guard h (no skipped heading level).

- [ ] **Step 9: Lint and commit.**

```bash
bun run lint
git add src/lo/LoBlock.tsx src/lo/LoBlock.test.tsx src/lo/blocks/VocabularyBlock.tsx src/lo/blocks/VocabularyBlock.test.tsx src/lo/blocks/VocabularyControls.tsx src/lo/blocks/VocabularySections.tsx src/lo/blocks/VocabularyRow.tsx
git commit -m "feat(vocabulary): the topic view, one list per topic under its heading (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Letter headings in the A–Z view

**Files:**

- Create: `src/lo/blocks/vocabulary-block.css`, `src/lo/blocks/vocabulary-block-css.test.ts`, `src/lo/blocks/VocabularyBlock.word-bank.test.tsx`
- Modify: `src/lo/blocks/VocabularySections.tsx`, `src/lo/blocks/VocabularyBlock.tsx`

- [ ] **Step 1: Write the failing tests.** Create `src/lo/blocks/vocabulary-block-css.test.ts`:

```ts
/**
 * vocabulary-block-css.test.ts — the A–Z view's letter headings (E63, spec §4, W6):
 * the letter centred, a thin rule either side, drawn by empty pseudo-elements so a
 * screen reader hears the letter alone.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(path.join(import.meta.dirname, 'vocabulary-block.css'), 'utf8');

describe('vocabulary-block.css letter headings', () => {
  test('lives in the components layer', () => {
    expect(css).toMatch(/@layer components\s*\{/);
  });

  test('centres the letter between two flexible rules', () => {
    expect(css).toMatch(/\.vocabulary-letter\s*\{[^}]*display: flex;[^}]*align-items: center;/);
    expect(css).toMatch(
      /\.vocabulary-letter::before,\s*\.vocabulary-letter::after\s*\{[^}]*content: '';[^}]*flex: 1;/,
    );
  });

  test('draws each rule as a 1px border in the border token', () => {
    expect(css).toMatch(/border-block-start: 1px solid var\(--border\);/);
  });
});
```

Create `src/lo/blocks/VocabularyBlock.word-bank.test.tsx` (Task 10 adds the self-test's tests and imports):

```tsx
// @vitest-environment happy-dom
/**
 * VocabularyBlock.word-bank.test.tsx — the word bank as a learner uses it (E63, spec
 * §4–5): the A–Z view's letter headings, and the self-test that hides one side and
 * reveals word by word. Mounted, because both need clicks.
 *
 * Language names are derived from the course language, never written in: the Russian
 * course runs these tests with `"languageCode": "ru"` (TODO, 2026-11-09).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';
import { VocabularyBlock } from './VocabularyBlock';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CLIP = 'audio/lo-00-example/placeholder.m4a';

const BANK = {
  topics: [{ id: 'one', heading: 'Topic one' }],
  items: [
    { term: 'beta', gloss: 'second', audio: CLIP, topic: 'one' },
    { term: 'alpha', gloss: 'first', audio: CLIP, topic: 'one' },
    { term: 'alpha beta', gloss: 'both', topic: 'one', only: 'topics' },
    { term: 'gamma', gloss: 'third', only: 'alphabetical' },
    { term: 'amber', gloss: 'fourth', only: 'alphabetical' },
  ],
};

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(options: Record<string, boolean>): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<VocabularyBlock content={BANK} options={options} />));
  return container;
}

/** The button whose accessible name or text is exactly `name`. */
function button(container: HTMLElement, name: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(
    (element) => (element.getAttribute('aria-label') ?? element.textContent) === name,
  );
  if (found === undefined) throw new Error(`no button named "${name}"`);
  return found;
}

const press = (element: HTMLElement) => act(() => element.click());
const headings = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('h4')).map((heading) => heading.textContent);
const terms = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);

describe('A–Z view with letter headings', () => {
  test('one centred <h4> per letter, the rule drawn in CSS', () => {
    const container = mount({ letterHeadings: true });
    press(button(container, 'Alphabetical'));

    expect(headings(container)).toEqual(['A', 'B', 'G']);
    expect(terms(container)).toEqual(['alpha', 'amber', 'beta', 'gamma']);
    const heading = container.querySelector('h4') as HTMLElement;
    expect(heading.className).toContain('vocabulary-letter');
    // The heading holds its letter and nothing else: the rules are pseudo-elements.
    expect(heading.childNodes).toHaveLength(1);
  });

  test('a second press reverses the list, and the headings with it', () => {
    const container = mount({ letterHeadings: true });
    press(button(container, 'Alphabetical'));
    press(button(container, 'Alphabetical'));

    expect(headings(container)).toEqual(['G', 'B', 'A']);
    expect(terms(container)).toEqual(['gamma', 'beta', 'amber', 'alpha']);
  });

  test('without letterHeadings, the A–Z view is one list', () => {
    const container = mount({});
    press(button(container, 'Alphabetical'));
    expect(headings(container)).toEqual([]);
    expect(terms(container)).toEqual(['alpha', 'amber', 'beta', 'gamma']);
  });
});
```

- [ ] **Step 2: Run them and see them fail.**
      Run: `bun run test src/lo/blocks/vocabulary-block-css.test.ts src/lo/blocks/VocabularyBlock.word-bank.test.tsx`
      Expected: FAIL: the CSS test cannot read `vocabulary-block.css` (ENOENT); the two letter-heading tests get `[]` headings (the option is not read yet). "without letterHeadings, the A–Z view is one list" passes already.

- [ ] **Step 3: Write the stylesheet.** Create `src/lo/blocks/vocabulary-block.css`:

```css
/**
 * vocabulary-block.css — the A–Z view's letter headings (E63, spec §4, W6): the letter
 * centred, with a thin rule either side. The rules are empty ::before/::after boxes, so
 * they are drawn and never announced: the heading reads as its letter alone. Plain CSS
 * rather than utilities: a pseudo-element pair is unreadable as arbitrary values.
 * Pinned by vocabulary-block-css.test.ts.
 */
@layer components {
  .vocabulary-letter {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .vocabulary-letter::before,
  .vocabulary-letter::after {
    content: '';
    flex: 1;
    border-block-start: 1px solid var(--border);
  }
}
```

(Guard f allows px on `border*`; the gap is in rem; guard g sees every rule in `@layer`.)

- [ ] **Step 4: Sections draw letter headings.** In `src/lo/blocks/VocabularySections.tsx`:
  1. After `import { VocabularyRow } from './VocabularyRow';` add `import './vocabulary-block.css';`
  2. Replace the props interface and the function's first line with:

```tsx
interface VocabularySectionsProps {
  sections: readonly VocabularySection<VocabularyItem>[];
  headingLevel: 'h3' | 'h4';
  /** Letter headings: centred, a thin rule either side (vocabulary-block.css). */
  letters: boolean;
}

export function VocabularySections({
  sections,
  headingLevel: Heading,
  letters,
}: VocabularySectionsProps) {
```

3. Replace `<Heading className={HEADING}>{section.heading}</Heading>` with:

```tsx
<Heading className={letters ? `vocabulary-letter ${HEADING}` : HEADING}>{section.heading}</Heading>
```

- [ ] **Step 5: The block reads `letterHeadings`.** In `src/lo/blocks/VocabularyBlock.tsx`:
  1. Replace the `parse-block-content` and schema imports with:

```tsx
import { parseBlockContent, parseBlockOptions } from './parse-block-content';
import { VocabularyBlockContentSchema } from './vocabulary-block-schema';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';
```

2. Replace the function signature and the content parse with:

```tsx
export function VocabularyBlock({
  content,
  options,
  labels,
  presentation = 'card',
}: BlockRendererProps) {
  const { items, summary, topics } = parseBlockContent(
    'vocabulary',
    VocabularyBlockContentSchema,
    content,
  );
  const { letterHeadings } = parseBlockOptions('vocabulary', VocabularyBlockOptionsSchema, options);
```

3. Replace the `sectionsFor` call with:

```tsx
const { view, sections } = sectionsFor(items, {
  mode: sortMode,
  topics,
  lang: TARGET_LANG,
  letterHeadings,
});
```

4. Give `<VocabularySections>` the new prop:

```tsx
<VocabularySections
  sections={sections}
  headingLevel={presentation === 'plain' ? 'h3' : 'h4'}
  letters={view === 'alphabetical'}
/>
```

- [ ] **Step 6: Run the tests again, then the CSS lint and guards.**
      Run: `bun run test src/lo src/guards && bun run lint:css`
      Expected: PASS; Stylelint reports nothing.

- [ ] **Step 7: Commit.**

```bash
git add src/lo/blocks/vocabulary-block.css src/lo/blocks/vocabulary-block-css.test.ts src/lo/blocks/VocabularyBlock.word-bank.test.tsx src/lo/blocks/VocabularySections.tsx src/lo/blocks/VocabularyBlock.tsx
git commit -m "feat(vocabulary): centred letter headings in the A–Z view (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The self-test

**Files:**

- Modify: `src/lo/blocks/VocabularyBlock.word-bank.test.tsx`, `src/lo/LoBlock.test.tsx`, and the whole of `src/lo/blocks/VocabularyControls.tsx`, `VocabularyRow.tsx`, `VocabularySections.tsx`, `VocabularyBlock.tsx`

- [ ] **Step 1: Write the failing tests.** In `src/lo/blocks/VocabularyBlock.word-bank.test.tsx`, replace the line `import { afterEach, describe, expect, test } from 'vitest';` with:

```tsx
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ROW_CLIP_ROW_SELECTOR } from '@/audio/row-clip';
import { languageName, TARGET_LANG } from '@/lib/lang';
```

add, right after the `Object.assign(globalThis, …)` line:

```tsx
const TARGET = languageName(TARGET_LANG);
```

and append at the end of the file:

```tsx
describe('self-test', () => {
  test('two toggle buttons in a group named "Test yourself", named for the languages', () => {
    const container = mount({ selfTest: true });
    const group = container.querySelector('[role="group"][aria-label="Test yourself"]');
    expect(group).not.toBeNull();
    expect(Array.from(group?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual([
      `Hide ${TARGET}`,
      'Hide English',
    ]);
    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('false');
  });

  test('hiding the course language removes its words from the DOM, leaving Reveal buttons', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));

    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).not.toContain('beta');
    expect(container.textContent).toContain('second');
    expect(button(container, `Reveal ${TARGET}, word 1`).textContent).toBe('Reveal');
    // The hidden cell holds English chrome, so its <dt> drops the course language.
    expect(container.querySelector('dt')?.hasAttribute('lang')).toBe(false);
  });

  test('a hidden term’s speaker is named for its slot, not its word, and still works', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    expect(button(container, 'Listen: word 1')).toBeDefined();
    expect(container.innerHTML).not.toContain('Listen: beta');
  });

  test('Reveal shows the word and moves focus to it, in the course language', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Reveal ${TARGET}, word 1`));

    const focused = document.activeElement as HTMLElement;
    expect(focused.textContent).toBe('beta');
    expect(focused.closest('[lang]')?.getAttribute('lang')).toBe(TARGET_LANG);
    expect(container.textContent).not.toContain('alpha');
  });

  test('hiding English hides the glosses and releases the other button', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, 'Hide English'));

    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('false');
    expect(button(container, 'Hide English').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('beta');
    expect(container.textContent).not.toContain('second');
    expect(button(container, 'Reveal English, word 2')).toBeDefined();
  });

  test('switching view keeps the hidden side and clears what was revealed', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Reveal ${TARGET}, word 1`));
    press(button(container, 'Alphabetical'));

    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('dt button[aria-label^="Reveal"]')).toHaveLength(4);
  });

  test('releasing the pressed button shows everything', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Hide ${TARGET}`));

    expect(container.textContent).toContain('beta');
    expect(container.querySelectorAll('button[aria-label^="Reveal"]')).toHaveLength(0);
  });

  test('no row click while a word is hidden; row clicks return once all are revealed', () => {
    const container = mount({ selfTest: true });
    expect(container.querySelectorAll(ROW_CLIP_ROW_SELECTOR)).toHaveLength(2);
    press(button(container, `Hide ${TARGET}`));
    expect(container.querySelectorAll(ROW_CLIP_ROW_SELECTOR)).toHaveLength(0);

    const played = vi.fn();
    const speaker = container.querySelector('[data-row-clip-speaker]') as HTMLElement;
    speaker.addEventListener('click', played);
    press(container.querySelector('dd') as HTMLElement);
    expect(played).not.toHaveBeenCalled();

    for (const number of [1, 2, 3]) press(button(container, `Reveal ${TARGET}, word ${number}`));
    expect(container.querySelectorAll(ROW_CLIP_ROW_SELECTOR)).toHaveLength(2);
  });
});
```

In `src/lo/LoBlock.test.tsx`, replace the test added in Task 8 with:

```tsx
// E63: the renderer gets the block's options and its labels override.
it("passes a block's options and labels to its renderer", () => {
  const html = render({
    type: 'vocabulary',
    title: 'Words',
    labels: { vocabularySemantic: 'By topic' },
    options: { selfTest: true },
    content: {
      items: [
        { term: 'hola', gloss: 'hello' },
        { term: 'adiós', gloss: 'goodbye' },
      ],
    },
  });
  expect(html).toContain('By topic');
  expect(html).toContain('aria-label="Test yourself"');
});
```

- [ ] **Step 2: Run them and see them fail.**
      Run: `bun run test src/lo/blocks/VocabularyBlock.word-bank.test.tsx src/lo/LoBlock.test.tsx`
      Expected: FAIL: every `self-test` test (`no button named "Hide Spanish"`, or the course language's name) and the LoBlock test (no "Test yourself"); the three letter-heading tests still pass.

- [ ] **Step 3: Replace the whole of `src/lo/blocks/VocabularyControls.tsx`:**

```tsx
/**
 * VocabularyControls — the vocabulary block's two button groups (E63, spec §4–5):
 * the view buttons (Semantic | Alphabetical, french-lo-1's PhraseTable) and the
 * self-test's Hide {language} | Hide English. Every button is a toggle with
 * `aria-pressed` and a name that never changes; the pressed one is filled.
 *
 * Native buttons styled by buttonVariants: the Button component would pull Base UI's
 * primitive into main-*.js, over the JS budget (docs/TOOLING.md).
 */
import { ArrowDownAZ, ArrowUpZA, EyeOff, Layers } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fillLabel, resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import { NATIVE_LANGUAGE_NAME, TARGET_LANGUAGE_NAME } from '@/lib/lang';
import type { HideSide, SelfTestState } from './vocabulary-self-test';
import type { VocabularySortMode } from './vocabulary-sort';

const toggleClass = (pressed: boolean): string =>
  buttonVariants({ variant: pressed ? 'default' : 'outline', size: 'lg' });

interface ViewButtonsProps {
  sortMode: VocabularySortMode;
  labels?: UiStringsOverride;
  onChoose: (pressed: 'semantic' | 'alphabetical') => void;
}

/** Semantic | Alphabetical. A second press of Alphabetical reverses the order (Z→A). */
export function ViewButtons({ sortMode, labels, onChoose }: ViewButtonsProps) {
  const isAlphabetical = sortMode !== 'semantic';
  const AlphabeticalIcon = sortMode === 'reverse' ? ArrowUpZA : ArrowDownAZ;
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={resolveLabel('vocabularyViews', labels)}
    >
      <button
        type="button"
        className={toggleClass(!isAlphabetical)}
        aria-pressed={!isAlphabetical}
        onClick={() => onChoose('semantic')}
      >
        <Layers aria-hidden="true" />
        {resolveLabel('vocabularySemantic', labels)}
      </button>
      <button
        type="button"
        className={toggleClass(isAlphabetical)}
        aria-pressed={isAlphabetical}
        onClick={() => onChoose('alphabetical')}
      >
        <AlphabeticalIcon aria-hidden="true" />
        {resolveLabel('vocabularyAlphabetical', labels)}
      </button>
    </div>
  );
}

const SIDES: readonly (readonly [HideSide, string])[] = [
  ['target', TARGET_LANGUAGE_NAME],
  ['native', NATIVE_LANGUAGE_NAME],
];

interface SelfTestButtonsProps {
  hidden: SelfTestState['hidden'];
  labels?: UiStringsOverride;
  onHide: (side: HideSide) => void;
}

/** Hide {language} | Hide English: either/or (W7), so pressing one releases the other. */
export function SelfTestButtons({ hidden, labels, onHide }: SelfTestButtonsProps) {
  const hide = resolveLabel('vocabularyHide', labels);
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={resolveLabel('vocabularySelfTest', labels)}
    >
      {SIDES.map(([side, language]) => (
        <button
          key={side}
          type="button"
          className={toggleClass(hidden === side)}
          aria-pressed={hidden === side}
          onClick={() => onHide(side)}
        >
          <EyeOff aria-hidden="true" />
          {fillLabel(hide, { language })}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Replace the whole of `src/lo/blocks/VocabularyRow.tsx`:**

```tsx
/**
 * VocabularyRow — one entry of the vocabulary block: the term, in the course language,
 * with its clip, and its gloss (E63 splits it out of VocabularyBlock.tsx).
 *
 * The speaker sits inside the `<dt>` and BEFORE the word. Inside, because a control in
 * a column of its own is separated from the thing it plays for anyone navigating by
 * element. Before, because it gives every row one shared left edge to scan down and
 * click, and because a vocabulary list is heard before it is read.
 *
 * SELF-TEST (spec §5). A hidden word is REMOVED FROM THE DOM, not hidden with CSS, so
 * assistive technology cannot read it early; its cell holds a Reveal button named for
 * its slot ("Reveal Russian, word 3"). The revealed word takes focus. While the term is
 * hidden its speaker is "Listen: word 3", not "Listen: брак", and the `<dt>` drops
 * `lang`: the cell then holds English chrome, and `lang` is for target-language text
 * only (§6).
 */
import { useEffect, useRef } from 'react';
import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';
import { AudioClip } from '@/components/audio/AudioClip';
import { buttonVariants } from '@/components/ui/button';
import { fillLabel, resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import { NATIVE_LANGUAGE_NAME, TARGET_LANG, TARGET_LANGUAGE_NAME } from '@/lib/lang';
import type { VocabularyItem } from './vocabulary-block-schema';
import { isHidden, type HideSide, type SelfTestState } from './vocabulary-self-test';

const LANGUAGE_NAMES: Readonly<Record<HideSide, string>> = {
  target: TARGET_LANGUAGE_NAME,
  native: NATIVE_LANGUAGE_NAME,
};

/** The word just revealed: focusable from script only, and focused once, on mount. */
function RevealedWord({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <span
      ref={ref}
      tabIndex={-1}
      className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {text}
    </span>
  );
}

export interface VocabularyRowProps {
  item: VocabularyItem;
  /** The entry's place in the view, from 1: how a hidden word is named ("word 3"). */
  number: number;
  test: SelfTestState;
  /** False while any word in the block is hidden, so a click never both plays and reveals (W8). */
  rowClicks: boolean;
  labels?: UiStringsOverride;
  onReveal: (term: string) => void;
}

export function VocabularyRow({
  item,
  number,
  test,
  rowClicks,
  labels,
  onReveal,
}: VocabularyRowProps) {
  const termHidden = isHidden(test, item.term, 'target');
  const glossHidden = isHidden(test, item.term, 'native');
  const focusSide = test.lastRevealed === item.term ? test.hidden : 'none';
  const plays = item.audio !== undefined && rowClicks;

  const cell = (side: HideSide, text: string, hidden: boolean) => {
    if (hidden) {
      return (
        <button
          type="button"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          aria-label={fillLabel(resolveLabel('vocabularyRevealWord', labels), {
            language: LANGUAGE_NAMES[side],
            number,
          })}
          onClick={() => onReveal(item.term)}
        >
          {resolveLabel('vocabularyReveal', labels)}
        </button>
      );
    }
    return focusSide === side ? <RevealedWord text={text} /> : text;
  };

  return (
    // THE WHOLE ROW PLAYS THE CLIP, and it is a MOUSE affordance only — no role, no
    // tabIndex, no key handler: the speaker inside is the keyboard path (E62). Only a
    // row WITH a clip gets the cursor and the hover, and none while a word is hidden.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- pointer-only enhancement (mouse and touch) over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
    <div
      onClick={plays ? playRowClip : undefined}
      data-row-clip={plays ? '' : undefined}
      className={`grid gap-x-6 rounded-md sm:col-span-2 sm:grid-cols-subgrid ${
        plays ? ROW_CLIP_CLASSES : ''
      }`}
    >
      <dt
        lang={termHidden ? undefined : TARGET_LANG}
        className="flex items-center gap-2 font-medium text-foreground"
      >
        {item.audio === undefined ? null : (
          // `title` is the speaker's accessible name: "play" alone would be the same on
          // every row, and a hidden term must not be spoken in it.
          <AudioClip
            className="super-compact-speaker"
            inline
            soundFile={item.audio}
            title={
              termHidden
                ? fillLabel(resolveLabel('vocabularyListenWord', labels), { number })
                : `Listen: ${item.term}`
            }
          />
        )}
        {cell('target', item.term, termHidden)}
      </dt>
      {/* Centred like the term, which sits beside a 54px speaker. */}
      <dd className="self-center text-muted-foreground">
        {cell('native', item.gloss, glossHidden)}
      </dd>
    </div>
  );
}
```

With nothing hidden the row renders exactly the markup Task 8's did: `RevealedWord` mounts only for the word just revealed, so the prerender is unchanged.

- [ ] **Step 5: Replace the whole of `src/lo/blocks/VocabularySections.tsx`:**

```tsx
/**
 * VocabularySections — the vocabulary block's list (E63, spec §4): one `<dl>` per
 * topic or letter, each under its heading. A topic without a heading is a divider
 * (none above the first). A list with one section and no heading is today's single
 * `<dl>`, unchanged (W3).
 *
 * HEADING LEVEL FOLLOWS PRESENTATION, as in the sources block: `<h3>` in a plain block,
 * under the section's `<h2>`; `<h4>` in a card, under the accordion's `<h3>`.
 *
 * The sections share one two-column grid (subgrid), so the terms line up across topics
 * and letters as they did in one list.
 */
import type { UiStringsOverride } from '@/config/ui-strings';
import type { VocabularyItem } from './vocabulary-block-schema';
import type { VocabularySection } from './vocabulary-letters';
import type { SelfTestState } from './vocabulary-self-test';
import { VocabularyRow } from './VocabularyRow';
import './vocabulary-block.css';

/** Two columns from `sm`, the term's as wide as the longest term: today's list. */
const LIST = 'grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]';
/** The same columns around sections, with more room between them. */
const SECTIONS = 'grid gap-x-6 gap-y-4 sm:grid-cols-[max-content_1fr]';
const HEADING = 'font-heading text-lg font-semibold text-foreground sm:col-span-2';

interface VocabularySectionsProps {
  sections: readonly VocabularySection<VocabularyItem>[];
  headingLevel: 'h3' | 'h4';
  /** Letter headings: centred, a thin rule either side (vocabulary-block.css). */
  letters: boolean;
  test: SelfTestState;
  rowClicks: boolean;
  labels?: UiStringsOverride;
  onReveal: (term: string) => void;
}

export function VocabularySections({
  sections,
  headingLevel: Heading,
  letters,
  ...rowProps
}: VocabularySectionsProps) {
  // Each entry's place in the whole view, from 1: "Reveal Russian, word 3".
  const numbers = new Map(
    sections.flatMap((section) => section.items).map((item, index) => [item.term, index + 1]),
  );
  const rows = (section: VocabularySection<VocabularyItem>) =>
    section.items.map((item) => (
      <VocabularyRow
        key={item.term}
        item={item}
        number={numbers.get(item.term) ?? 0}
        {...rowProps}
      />
    ));

  const [first] = sections;
  if (sections.length === 1 && first !== undefined && first.heading === undefined) {
    return <dl className={LIST}>{rows(first)}</dl>;
  }
  return (
    <div className={SECTIONS}>
      {sections.map((section, index) => (
        <div key={section.key} className="grid gap-y-2 sm:col-span-2 sm:grid-cols-subgrid">
          {section.heading === undefined ? (
            index === 0 ? null : (
              <hr className="border-border sm:col-span-2" />
            )
          ) : (
            <Heading className={letters ? `vocabulary-letter ${HEADING}` : HEADING}>
              {section.heading}
            </Heading>
          )}
          <dl className="grid gap-y-2 sm:col-span-2 sm:grid-cols-subgrid">{rows(section)}</dl>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Replace the whole of `src/lo/blocks/VocabularyBlock.tsx`:**

```tsx
/**
 * VocabularyBlock — `type: "vocabulary"`. A term/gloss list, rendered as `<dl>`s: the
 * description-list element IS the semantic for "term and its definition", so no `<ul>`
 * of `<span>` pairs.
 *
 * `lang` (spec §3, WCAG 3.1.2) is per-part, not per-block: the TERM is target
 * language, its GLOSS is the UI language, so only the `<dt>` carries TARGET_LANG.
 *
 * A WORD BANK (E63, docs/specs/2026-11-12-vocabulary-word-bank-design.md). One list per
 * lesson, each word written and recorded once, shown two ways: the topic view (the
 * authored order, grouped by `topics`) and the A–Z view (the course language's order,
 * with letter headings when `options.letterHeadings`). `options.selfTest` adds Hide
 * {language} / Hide English, and a Reveal button per hidden word. Everything new is
 * off by default: a block with only `items` renders as before (W3).
 *
 * This file holds the state; the list is VocabularySections and VocabularyRow, the
 * buttons VocabularyControls, and the rules are pure modules beside them
 * (vocabulary-views, -letters, -self-test), each with its own tests.
 */
import { useReducer, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import Callout from '@/components/shell/Callout';
import { TARGET_LANG } from '@/lib/lang';
import { RichText } from '../rich-text/RichText';
import type { BlockRendererProps } from './block-renderers';
import { parseBlockContent, parseBlockOptions } from './parse-block-content';
import { VocabularyBlockContentSchema } from './vocabulary-block-schema';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';
import { INITIAL_SELF_TEST, isAnyHidden, selfTestReducer } from './vocabulary-self-test';
import { nextSortMode, type VocabularySortMode } from './vocabulary-sort';
import { offersBothViews, sectionsFor, viewFor } from './vocabulary-views';
import { SelfTestButtons, ViewButtons } from './VocabularyControls';
import { VocabularySections } from './VocabularySections';

export function VocabularyBlock({
  content,
  options,
  labels,
  presentation = 'card',
}: BlockRendererProps) {
  const { items, summary, topics } = parseBlockContent(
    'vocabulary',
    VocabularyBlockContentSchema,
    content,
  );
  const { selfTest, letterHeadings } = parseBlockOptions(
    'vocabulary',
    VocabularyBlockOptionsSchema,
    options,
  );
  // The topic view, nothing hidden, on the first render: the prerendered markup and
  // the first client render agree. The learner changes both with the buttons.
  const [sortMode, setSortMode] = useState<VocabularySortMode>('semantic');
  const [test, dispatch] = useReducer(selfTestReducer, INITIAL_SELF_TEST);
  const { view, sections } = sectionsFor(items, {
    mode: sortMode,
    topics,
    lang: TARGET_LANG,
    letterHeadings,
  });
  const shownTerms = sections.flatMap((section) => section.items.map((item) => item.term));
  const showViews = offersBothViews(items);

  const choose = (pressed: 'semantic' | 'alphabetical') => {
    const next = nextSortMode(sortMode, pressed);
    // Switching view clears what was revealed; reversing the A–Z view does not.
    if (viewFor(next, items) !== view) dispatch({ type: 'switch-view' });
    setSortMode(next);
  };

  return (
    <div className="grid gap-6">
      {summary === undefined ? null : (
        // No top margin: the accordion body's own pt-2 gives the 8px this alert once
        // carried (LoAccordion, maintainer 2026-10-08).
        <Callout variant="info" title={<RichText nodes={summary.lead} />}>
          {/* The outcomes block's ticked list: semantics from <ul>/<li>, ticks aria-hidden. */}
          <ul className="mt-3 grid gap-2">
            {summary.items.map((item, index) => (
              // Static config, never reordered: the index is a stable key.
              <li key={index} className="flex items-start gap-2">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0">
                  <RichText nodes={item} />
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {showViews || selfTest ? (
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {showViews ? <ViewButtons sortMode={sortMode} labels={labels} onChoose={choose} /> : null}
          {selfTest ? (
            <SelfTestButtons
              hidden={test.hidden}
              labels={labels}
              onHide={(side) => dispatch({ type: 'hide', side })}
            />
          ) : null}
        </div>
      ) : null}

      <VocabularySections
        sections={sections}
        headingLevel={presentation === 'plain' ? 'h3' : 'h4'}
        letters={view === 'alphabetical'}
        test={test}
        rowClicks={!isAnyHidden(test, shownTerms)}
        labels={labels}
        onReveal={(term) => dispatch({ type: 'reveal', term })}
      />
    </div>
  );
}
```

- [ ] **Step 7: Run everything the block touches, then type-check and lint.**
      Run: `bun run test src/lo src/guards src/config src/lib && bun run lint && bunx tsc -b`
      Expected: PASS; lint and `tsc` print nothing.

- [ ] **Step 8: Run the block tests with the Russian course's language once** (a course runs the template's tests with its own `languageCode`; TODO 2026-11-09). Change `"languageCode": "es"` to `"ru"` in `course.json`, run `bun run test src/lo src/lib src/config src/exercises/flashcards`, expect PASS, then put `"es"` back and confirm with `git diff --exit-code course.json`. Never commit the `ru` change.

- [ ] **Step 9: Commit.**

```bash
git add src/lo/LoBlock.test.tsx src/lo/blocks/VocabularyBlock.word-bank.test.tsx src/lo/blocks/VocabularyControls.tsx src/lo/blocks/VocabularyRow.tsx src/lo/blocks/VocabularySections.tsx src/lo/blocks/VocabularyBlock.tsx
git commit -m "feat(vocabulary): a self-test that hides one side and reveals word by word (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The example lesson shows the word bank

The spec (§8) asks for this, as the credits work showed its feature in the example; the maintainer approved the spec, so editing `lo-00-example` is sanctioned here (AGENTS.md's "never edit the example" is for course authors copying it). Content stays language-neutral placeholders: every course builds the example with its own `languageCode`.

**Files:**

- Modify: `lo-config/lo-00-example/blocks/02-vocabulary/block.json` (whole file)

- [ ] **Step 1: Replace the whole file with:**

```json
{
  "type": "vocabulary",
  "title": "Placeholder vocabulary list",
  "options": { "selfTest": true, "letterHeadings": true },
  "content": {
    "summary": {
      "lead": "You will learn:",
      "items": [
        "Placeholder group one (<em>term one, phrase two</em>).",
        "Placeholder group two (<em>another term</em>).",
        "Replace these lines with what the list teaches — Semantic shows it by topic, Alphabetical from A to Z, and Test yourself hides one side."
      ]
    },
    "topics": [{ "id": "group-one", "heading": "Placeholder topic one" }, { "id": "group-two" }],
    "items": [
      {
        "term": "Placeholder term one",
        "gloss": "placeholder gloss one",
        "audio": "audio/lo-00-example/placeholder.m4a",
        "topic": "group-one"
      },
      {
        "term": "Placeholder phrase two",
        "gloss": "placeholder gloss two",
        "audio": "audio/lo-00-example/placeholder.m4a",
        "topic": "group-one",
        "only": "topics"
      },
      {
        "term": "Another placeholder term",
        "gloss": "placeholder gloss three",
        "audio": "audio/lo-00-example/placeholder.m4a",
        "topic": "group-two"
      },
      {
        "term": "Headword placeholder",
        "gloss": "placeholder gloss four",
        "audio": "audio/lo-00-example/placeholder.m4a",
        "only": "alphabetical"
      }
    ]
  }
}
```

The topic view shows "Placeholder topic one" (two entries), a divider, then "Another placeholder term"; the A–Z view shows A, H and P, in any course language.

- [ ] **Step 2: Check it loads, prerenders and passes the guards.**
      Run: `bun run format && bun run test src/config/example-lo.test.ts src/guards src/lo && bun run build`
      Expected: PASS (`example-lo.test.ts` parses the new `options`; guard d finds the audio; guard h sees `<h3>` → `<h4>` with no skipped level); the build ends with `prerendered lo-00-example → dist/example.html`.

- [ ] **Step 3: Commit.**

```bash
git add lo-config/lo-00-example/blocks/02-vocabulary/block.json
git commit -m "feat(example): the example lesson's vocabulary is a word bank (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The browser test: the drill from the keyboard, and axe

**Files:**

- Create: `e2e/vocabulary-word-bank.spec.ts`

Two things the prototype found, both handled in the spec below: (a) a toggle that has just been pressed fades to its filled colours (`transition-all` in `buttonVariants`), and axe measuring mid-fade reported 2.7:1, so each press waits for the block's animations; (b) a mouse click leaves the pointer over the pressed button, and axe then measured its **hover** colour, `hover:bg-primary/80`, at 3.54:1 in light mode. Pressing from the keyboard keeps the test about the settled page. Finding (b) is not this feature's: every filled `buttonVariants` toggle has it, the existing Semantic button included. Report it to the maintainer as its own item; do not change `buttonVariants` here.

- [ ] **Step 1: Write the test.** Create `e2e/vocabulary-word-bank.spec.ts`:

```ts
/**
 * vocabulary-word-bank.spec.ts — the example lesson's word bank (E63, spec §4–5, §8):
 * the self-test drill from the keyboard, and axe with words hidden, in both views and
 * both colour schemes.
 *
 * The course-language button is found by its shape, never by "Hide Spanish": a course
 * runs this suite with its own `languageCode` (TODO, 2026-11-09).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  animationsInside,
  animationsSettled,
  exampleReady,
  expectNoAxeViolations,
  openExercise,
  watchForProblems,
} from './support';

/** The example's vocabulary block: `blocks/02-vocabulary`, so its accordion heading id. */
const VOCABULARY_HEADING = '#block-02-vocabulary-heading';
const FIRST_TERM = 'Placeholder term one';

async function openWordBank(page: Page): Promise<Locator> {
  await page.goto('example.html');
  await exampleReady(page);
  await animationsSettled(page);
  return openExercise(page, VOCABULARY_HEADING);
}

/**
 * Presses a button from the keyboard, then waits for its colour change to finish: a
 * pressed toggle fades to its filled colours (`transition-all`), and axe measuring
 * mid-fade reports a contrast the settled page does not have. The keyboard also keeps
 * the pointer off the button, so axe never measures its hover colour.
 */
async function press(page: Page, bank: Locator, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
  // The bank, not the button: a Reveal button leaves the page when pressed.
  await animationsInside(bank);
}

/** Hide {course language}: the button in "Test yourself" that is not "Hide English". */
const hideTarget = (bank: Locator): Locator =>
  bank
    .getByRole('group', { name: 'Test yourself' })
    .getByRole('button', { name: /^Hide (?!English$)/ });

test('the self-test drill from the keyboard: hide, reveal, focus, switch view', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const bank = await openWordBank(page);
  const hide = hideTarget(bank);

  await press(page, bank, hide);
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.getByText(FIRST_TERM, { exact: true })).toHaveCount(0);

  await press(page, bank, bank.getByRole('button', { name: /, word 1$/ }));
  const word = bank.getByText(FIRST_TERM, { exact: true });
  await expect(word).toBeFocused();
  await expect(word.locator('xpath=ancestor::dt[1]')).toHaveAttribute('lang', /.+/);

  const alphabetical = bank.getByRole('button', { name: 'Alphabetical' });
  await alphabetical.focus();
  await page.keyboard.press('Space');
  await expect(alphabetical).toHaveAttribute('aria-pressed', 'true');
  // The hide setting survives the switch; what was revealed does not.
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.getByText(FIRST_TERM, { exact: true })).toHaveCount(0);
  await expect(bank.getByRole('heading', { level: 4, name: 'A', exact: true })).toBeVisible();
  expect(problems).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('no axe violations with words hidden, in both views', async ({ page }) => {
      const bank = await openWordBank(page);
      await press(page, bank, hideTarget(bank));
      await expect(bank.getByRole('button', { name: /, word 1$/ })).toBeVisible();
      await expectNoAxeViolations(page);

      await press(page, bank, bank.getByRole('button', { name: 'Alphabetical' }));
      await expect(bank.getByRole('heading', { level: 4, name: 'A', exact: true })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}
```

(`openExercise` opens any accordion by its heading id; the name is historical.)

- [ ] **Step 2: Build and run it, three times over, in all three browsers.**
      Run: `bun run build && bun run test:e2e -- e2e/vocabulary-word-bank.spec.ts --repeat-each=3`
      Expected: `27 passed`. (Firefox 155 may not start on some Macs, see TODO; then expect 18 passed with Firefox skipped, and rely on CI for it.)

- [ ] **Step 3: Lint and commit.**

```bash
bun run lint
git add e2e/vocabulary-word-bank.spec.ts
git commit -m "test(e2e): the word bank's self-test drill from the keyboard, and axe with words hidden (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Docs, the bundle budget and the full gate

**Files:**

- Modify: `CONTRIBUTING.md`, `.claude/skills/add-lo/SKILL.md`, `public/llms.txt`, `docs/TOOLING.md`, `docs/process/TODO.md`, `docs/specs/2026-11-12-vocabulary-word-bank-design.md`

- [ ] **Step 1: Re-read each doc immediately before editing it** (AGENTS.md: Prettier reflows tables, so an edit written against a stale copy fails).

- [ ] **Step 2: `CONTRIBUTING.md`.** Add this section immediately before `### Sources block`:

````markdown
### Vocabulary block (word bank)

A lesson's words and phrases, each written and recorded once, shown two ways: **Semantic**
(by topic, in the order written) and **Alphabetical** (A to Z in the course language; a
second press reverses it). `lo-00-example` has one in its Vocabulary section
(`blocks/02-vocabulary/`).

```json
{
  "type": "vocabulary",
  "title": "Vocabulary",
  "options": { "selfTest": true, "letterHeadings": true },
  "content": {
    "topics": [{ "id": "marriage", "heading": "Marriage" }, { "id": "attitudes" }],
    "items": [
      { "term": "брак", "gloss": "marriage", "audio": "…", "topic": "marriage" },
      {
        "term": "гражда́нский брак",
        "gloss": "civil partnership",
        "audio": "…",
        "topic": "marriage",
        "only": "topics"
      },
      { "term": "гражда́нский", "gloss": "civil", "audio": "…", "only": "alphabetical" },
      { "term": "развод", "gloss": "divorce", "audio": "…", "topic": "attitudes" }
    ]
  }
}
```

- `term` is the course language, `gloss` English, `audio` an optional recording of the term.
- `only` keeps an entry to one view: `"topics"` (a phrase that belongs with its topic) or
  `"alphabetical"` (a headword for the A–Z list). Without it, the entry shows in both.
- `topics` (optional) groups the Semantic view, in the order listed; each entry shown
  there names its group with `topic`. A topic without a `heading` shows as a line.
- `options.letterHeadings` puts a letter over each run of the A–Z list. Which letters
  share one (Russian ё with е, Spanish ñ on its own) is the course language's own
  alphabetical order, not a rule of ours.
- `options.selfTest` adds **Hide <language>** and **Hide English**: one side of every
  entry is replaced by a Reveal button. Both options are off by default.
- The build fails, naming the entry, on: a `topic` not in `topics`; with `topics`, an
  entry in the Semantic view with no `topic`; a topic nothing uses; `topic` with
  `"only": "alphabetical"`; the same `term` twice; an unknown key in `options`.
- `labels` renames the buttons for one block, e.g.
  `"labels": { "vocabularySemantic": "By topic" }`; the keys are in
  `src/config/ui-strings.ts`.

Design: [`docs/specs/2026-11-12-vocabulary-word-bank-design.md`](docs/specs/2026-11-12-vocabulary-word-bank-design.md).
````

- [ ] **Step 3: `.claude/skills/add-lo/SKILL.md`.** At the end of step 4 ("Fill it in"), after the sentence about the `culp-syllabus` skill, add:

```markdown
A vocabulary block is a word bank: write each word once, and place it in the two
views with `topic` and `only`
([`CONTRIBUTING.md` → "Vocabulary block (word bank)"](../../../CONTRIBUTING.md#vocabulary-block-word-bank)).
```

- [ ] **Step 4: `public/llms.txt`.** In "## Content blocks", after the sentence ending "…whose meaning is also given as screen-reader text.", add:

```text
A `vocabulary` block is a word list in `<dl>`s, shown two ways by toggle buttons
(`aria-pressed`): by topic, under `<h4>` headings (`<h3>` in a plain block), and A to Z
in the course language, optionally under letter headings. Its optional self-test
(Hide <language> / Hide English) removes one side of each entry from the DOM and puts a
Reveal button in its place; revealing moves focus to the word.
```

- [ ] **Step 5: `docs/TOOLING.md`, "Bundle budget".** Measure against `main` built the same day, as the section asks:

```bash
bun run build
for f in dist/assets/main-*.js dist/assets/main-*.css; do echo "$f"; done   # then read Vite's own gzip column from the build output
rm -rf /tmp/lc-main && mkdir /tmp/lc-main && git archive origin/main | tar -x -C /tmp/lc-main
ln -s "$PWD/node_modules" /tmp/lc-main/node_modules && (cd /tmp/lc-main && bun run build | grep -E 'main-')
```

The prototype measured (Vite's gzip, plain `bun run build`): **JS 134.79 → 136.98 kB, CSS 18.00 → 18.05 kB**, both under budget (140 / 19 kB). Update the table's "Measured" column and headroom with today's numbers, and add a bullet at the top of the list under it, in the existing form: "**Vocabulary word bank (2026-11-NN, TODO §E63): JS <before> → <after> kB, CSS <before> → <after> kB**, against `main` built the same day: the word bank's views, letters, self-test reducer and the split view; the block is not lazy, so all of it is in `main-*.js`." with the numbers you measured. If JS is over 140 kB, stop and tell the maintainer before going further.

- [ ] **Step 6: `docs/process/TODO.md`.**
  1. Add a dated paragraph at the top of the log, above the current "**Latest, …**" paragraph, and relabel that one as the log already does for same-day entries (the ones below it read "Even later", "Later again", "Later still", "Later"; on a different day it keeps its own date and takes the next such word for that day):

```markdown
**Latest, 2026-11-NN (work iMac): one word bank per lesson (E63) built, on `feat/vocabulary-word-bank`, not yet merged.** The vocabulary block is now a word bank: each word or phrase written and recorded once, shown by topic (`topics`, `topic`) and A to Z (`only` keeps an entry to one view), with optional centred letter headings from the course language's collation and an optional self-test (Hide <language> / Hide English, Reveal word by word). Off by default: a block with only `items` renders as before. Block `options` are now checked per block type at load, and a block's `labels` reach its renderer. The example lesson shows all of it. Answers template issue 108, differently from what it asked (W4: no `sort: false`). Spec and plan: `docs/specs/2026-11-12-vocabulary-word-bank-design.md`, `docs/process/2026-11-12-vocabulary-word-bank-plan.md`. Full gate on the branch: <N> tests passed, coverage bars met, <N> e2e passed, <N> debug e2e passed. **Next:** the maintainer reviews and opens the pull request (with the framing in the spec §9) and approves the reply to issue 108; the courses take it with the next template update; then the Russian lesson 1 worked example (spec §7). Also found: a filled `buttonVariants` toggle under the mouse is 3.54:1 in light mode (`hover:bg-primary/80`), every such toggle, not only this block's: its own item.
```

2. Add this entry immediately after the E62 entry in section E:

```markdown
- **E63 — one word bank per lesson, shown by topic and A–Z. BUILT 2026-11-NN** (branch `feat/vocabulary-word-bank`, not yet merged; template issue 108). The vocabulary block holds one list per lesson, each entry written and recorded once, shown in a topic view and an A–Z view, with optional letter headings and an optional self-test. New block envelope field `options`, checked per block type (`src/lo/blocks/block-options-schemas.ts`); `LoBlock` passes `options` and `labels` to renderers. Deviations are listed in the spec. **Verify:** `vocabulary-block-schema.test.ts`, `vocabulary-views.test.ts`, `vocabulary-letters.test.ts`, `vocabulary-self-test.test.ts`, `VocabularyBlock.word-bank.test.tsx`, and `e2e/vocabulary-word-bank.spec.ts`. **Next:** review and the pull request; then the Russian lesson 1 worked example in `lc-russian-basic-vocabulary` (spec §7).
```

Fill `<N>` and the date from Step 8's run.

- [ ] **Step 7: The spec.** In `docs/specs/2026-11-12-vocabulary-word-bank-design.md`, set the status line to `**Date:** 2026-11-12 · **Status:** built 2026-11-NN (TODO §E63) · **Plan:** [`2026-11-12-vocabulary-word-bank-plan.md`](../process/2026-11-12-vocabulary-word-bank-plan.md)`, and append:

```markdown
## 11. Deviations from this spec

Decided while planning (2026-11-12), each because the code needed an answer the design
did not give:

- **The block's `labels` now reach its renderer.** `BlockConfigSchema` accepted them but
  `LoBlock` never passed them on, so W10's override did nothing until now.
- **Nine `ui-strings` keys**, not two: the view buttons' words and their group's name,
  the self-test's group, Hide, Reveal and its accessible name, and the two speaker names
  (visible term, hidden term). `{language}`, `{number}` and `{term}` are filled by
  `fillLabel`, which inserts values literally (a `$` is safe); a rewording that drops one
  is refused.
- **Heading level follows presentation:** `<h4>` in a card, `<h3>` in a plain block, as
  the sources block does.
- **A topic without a heading is a divider except the first,** which has nothing above it.
- **More build failures:** a topic `id` declared twice, a misspelt key in a topic, and an
  empty `topics`.
- **`lang` sits on a span around the term text, never on the `<dt>`,** so the speaker's
  accessible name and a Reveal button (English chrome) are never inside it (§6). The
  visible speaker's name comes from the `vocabularyListen` string ("Listen: {term}").
- **"word 3" is the place in the current view,** counted across its sections.
- **Reversing the A–Z view keeps what was revealed;** only Semantic ↔ Alphabetical clears it.
- **Letter headings are cut from the A→Z order and reversed with it,** so a heading is the
  same both ways. The heading shows the language's base letter whenever the collator
  treats the marked and unmarked letter as the same (all marks removed then): German Ä
  heads A, French É and Ê head E, Russian ё heads Е (dictionaries file it there). Letters
  the language treats as distinct keep their marks: Spanish Ñ, Russian Й, Polish Ó. A
  leading bracket is skipped.
- **One collator sorts and sections the A–Z view,** `vocabularyCollator(lang)` in
  `vocabulary-sort.ts`: `{ sensitivity: 'base', ignorePunctuation: true }`, not §4's
  `{ sensitivity: 'base' }`. This also changes existing courses' A–Z order for entries
  that start with punctuation: they now sort by their first letter.
- **Content rules fail the build at the prerender, not the loader:** block content is
  parsed by its renderer, so the message names the block type and the entry, not the file.
  `options` are checked by the loader and name the file.
- **An entry's own keys are strict:** an unknown key fails the build with a message
  naming the entry and the key (maintainer decision, 2026-11-12). Every vocabulary entry
  in the Russian course's lessons 1–4 uses only `term`, `gloss` and `audio`; no other
  course has lessons yet.
- **A bad `only` value's message names the entry** (`entry "брак": "only" must be ...`).
- **Letter headings still show while the course language is hidden,** so each heading
  gives away its words' first letter. The design is silent; left as is.
```

- [ ] **Step 8: Run the full gate** (AGENTS.md), then the debug suite, since the add-lo skill page (`claude-skills.html`) renders the edited skill:

```bash
bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e
DEBUG=1 bun run build && DEBUG=1 bun run test:e2e
```

Expected: everything green. The prototype measured 100% lines on every new `.ts` file and 90.9% on `VocabularyControls.tsx`. A file below its bar means an untested branch: add the case to its test, never an exclusion.

- [ ] **Step 9: Commit.**

```bash
git add CONTRIBUTING.md .claude/skills/add-lo/SKILL.md public/llms.txt docs/TOOLING.md docs/process/TODO.md docs/specs/2026-11-12-vocabulary-word-bank-design.md
git commit -m "docs: record one word bank per lesson (E63)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Draft, do not post.** For the maintainer's approval (spec §9), write in the hand-back, not on GitHub:
  - **Issue 108 reply:** thank the author; what is built (one word bank per lesson, by topic and A to Z, letter headings, Hide / Reveal); what differs and why (no `sort: false`: the 2015 page's two accordions become two views in one block, and each word is written and recorded once, W1, W4); how to try it (the example lesson once the template update lands); that lesson 1 will be converted as the worked example.
  - **Pull request description,** opening with the maintainer's framing from spec §9: the layout is modernised with the LC template; the 2015 teaching approach is kept — two ways in, phrases in the topic view and headwords in A–Z, stress and grammar notes, a recording for every entry, self-testing; each word written and recorded once. Then the summary, the deviations (spec §11), the test plan, and `Closes #108` only if the maintainer agrees the issue is answered. End with the attribution line.

  Do not push or open the pull request without the maintainer's go-ahead; the `before-pr` skill walks the checklist.

---

## After merge: Russian lesson 1 worked example

Not part of this template plan: it happens in `lc-russian-basic-vocabulary` once a template update carrying E63 has merged there (spec §7, W9). High-level steps, in order:

1. Wait for the course's template update that includes E63 to be merged (the `sync-from-template` skill prepares it; the course's author opens and merges the pull request).
2. On a new branch in the course (not the author's open lesson branches), read lesson 1's `03-vocabulary` (topic list, 55 entries) and `03b-vocabulary-alphabetic` (A–Z list, 63 entries).
3. Match entries across the two lists, ignoring stress, case, spacing, bracketed grammar notes and Latin look-alike letters. A match becomes one entry with no `only`; the rest get `"only": "topics"` or `"only": "alphabetical"`.
4. List every near-duplicate for a person to decide (e.g. _мать-одиночка_ against _мать-одиночка / отец-одиночка_; `(+ inst)` against `(+ instr)`; the Latin `c` in `бороться (c + inst)`), and record each decision in the pull request.
5. Keep one recording per shared word, the topic list's (W5); delete the A–Z recordings no longer referenced in the same branch (guard d confirms nothing points at a deleted file).
6. Recover the nine topic groups from the 2015 unit 1 page (`unit1.zip`) into `topics`, with placeholder headings for the maintainer or the author to name.
7. Write one `blocks/03-vocabulary/block.json` with `"options": { "selfTest": true, "letterHeadings": true }`, remove `03b-vocabulary-alphabetic` and its `lo.json` reference, and keep the folder names in step with the config (guard b).
8. Run the course's full gate, with its `"languageCode": "ru"`.
9. Push the branch for the author to open the pull request; its description carries the short how-to for lessons 2–4 (how the lists map onto `topic` and `only`, how a near-duplicate was decided, which recording was kept). The maintainer reviews it.

---

## Self-review

**Spec coverage:**

| Spec                                                                      | Task                     |
| ------------------------------------------------------------------------- | ------------------------ |
| §3 `options` on the envelope, per type                                    | 1                        |
| §3 `topics`, `topic`, `only`; rules 1–5 and `only`'s values               | 4                        |
| §3 rule 6, unknown key in `options`                                       | 1                        |
| §4 view buttons, labels per W10, `aria-pressed`, group "Choose a view"    | 3, 8                     |
| §4 topic view shown first; empty view → no buttons                        | 6, 8                     |
| §4 topic sections, `<h4>` or divider, written order; flat without topics  | 6, 8                     |
| §4 A–Z order (base collator), reverse, letter headings reverse with it    | 5, 6, 9                  |
| §4 centred heading, decorative rule in CSS; each section its own `<dl>`   | 8, 9                     |
| §5 Hide {language} / Hide English, names from `Intl.DisplayNames` in lang | 2, 3, 10                 |
| §5 either/or; fixed names; hidden word out of the DOM; Reveal named       | 7, 10                    |
| §5 focus on reveal, `lang`; neutral speaker name                          | 10                       |
| §5 switch view keeps hide, clears reveals; release shows all; reducer     | 7, 10                    |
| §5 no animation                                                           | 10 (none added)          |
| §6 accessibility, 320px (gloss stacks below `sm`, as today)               | 8, 10, 12                |
| W8 row click through E62, off while hidden                                | 0, 10                    |
| §8 tests: schema, views, letters, reducer, view, example, browser         | 4, 6, 5, 7, 8–10, 11, 12 |
| §9 docs, issue 108 reply, PR framing                                      | 13                       |
| §7 Russian lesson 1                                                       | after merge              |

**Placeholders:** the only fill-ins are measured values (bundle sizes, test counts, the build date) in Task 13, each with the command that produces it and the prototype's figure.

**Names used across tasks:** `VocabularyBlockOptionsSchema`, `blockOptionsSchema`, `parseBlockOptions`, `languageName`, `TARGET_LANGUAGE_NAME`, `NATIVE_LANGUAGE_NAME`, `fillLabel`, `VocabularySection`, `firstLetter`, `headingLetter`, `letterSections`, `entriesInView`, `offersBothViews`, `viewFor`, `topicSections`, `alphabeticalSections`, `sectionsFor`, `WordBankEntry`, `HideSide`, `SelfTestState`, `INITIAL_SELF_TEST`, `selfTestReducer`, `isHidden`, `isAnyHidden`, `ViewButtons`, `SelfTestButtons`, `VocabularySections`, `VocabularyRow`: each is defined once, in the task that creates it, and used with the same signature after.
