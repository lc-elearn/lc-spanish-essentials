# Tap anywhere on a row to hear it (E62) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every row that carries its own clip plays it when tapped or clicked anywhere on the row, through one shared helper, in the vocabulary block and six exercise types.

**Architecture:** A pure DOM helper, `src/audio/row-clip.ts`, decides whether a row click should play and, if so, clicks the row's own speaker button, found by a `data-row-clip-speaker` marker the speaker now carries. Each row with a clip sets `onClick={playRowClip}`, `data-row-clip` and the shared hover classes. The speaker stays the only owner of playback.

**Tech stack:** React 19, TypeScript, Vitest (`node` by default, `happy-dom` opted in per file), Playwright (debug suite for the showcase), Tailwind classes, ESLint with `jsx-a11y`.

**Spec:** [`docs/specs/2026-11-12-row-click-audio-design.md`](../specs/2026-11-12-row-click-audio-design.md) · **Branch:** `feat/row-click-audio` (spec already committed)

**Repo rules that apply to every task** (`AGENTS.md`): run tests with `bun run test`, **never `bun test`**; a test is written first and seen failing; no raw hex or raw px; every rule in `@layer`; one concern per commit, Conventional Commits; never push to `main`.

**One addition to the spec:** each row with a clip also gets a `data-row-clip` attribute. It changes nothing for learners; the tests and the browser test find rows by it.

---

## File map

| File                                                                        | Change                                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.tsx`      | interactive speaker `<button>` gains `data-row-clip-speaker`                                  |
| `src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.test.tsx` | tests for the marker                                                                          |
| `src/audio/row-clip.ts`                                                     | **new**: `ROW_CLIP_SPEAKER_ATTRIBUTE`, `ROW_CLIP_CLASSES`, `shouldPlayRowClip`, `playRowClip` |
| `src/audio/row-clip.test.ts`                                                | **new**: unit tests (happy-dom)                                                               |
| `src/lo/blocks/VocabularyBlock.tsx`                                         | uses the helper; its private `playRowClip` is deleted                                         |
| `src/lo/blocks/VocabularyBlock.row-clip.test.tsx`                           | **new**: mounted test (happy-dom)                                                             |
| `src/exercises/inline-gap/InlineTypedGapExercise.tsx`                       | row `<div>` wired                                                                             |
| `src/exercises/text-entry/TextEntryRuntime.tsx`                             | `TableRow` wired                                                                              |
| `src/exercises/phrase-reorder/PhraseReorderExercise.tsx`                    | slot `<li>` wired                                                                             |
| `src/exercises/drag-fill-gaps/DragFillGapsExercise.tsx`                     | row `<li>` wired                                                                              |
| `src/exercises/word-spot/WordSpotExercise.tsx`                              | row `<li>` wired                                                                              |
| `src/exercises/line-match/LineMatchExercise.tsx`                            | phone-layout `<li>` wired                                                                     |
| `src/exercises/lib/row-clip-engines.test.tsx`                               | **new**: one mounted test per engine (happy-dom), like `flip-cue-engines.test.tsx`            |
| `e2e/debug/showcase-audio.spec.ts`                                          | phone-size tap test                                                                           |
| `docs/STYLE.md`, `CONTRIBUTING.md`, `docs/process/TODO.md`                  | docs                                                                                          |

---

### Task 1: Mark the speaker button

**Files:**

- Modify: `src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.tsx` (the interactive `<button>`, about line 151)
- Test: `src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.test.tsx`

- [ ] **Step 1: Write the failing tests.** Append to the test file (it already imports `describe`, `expect`, `test`; add the two imports below if missing):

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { CircularAudioProgressAnimatedSpeakerDisplay } from './CircularAudioProgressAnimatedSpeakerDisplay';

// E62: a row click finds its speaker by this marker, never as "the first button".
describe('row-clip marker', () => {
  test('the interactive speaker carries data-row-clip-speaker', () => {
    const html = renderToStaticMarkup(<CircularAudioProgressAnimatedSpeakerDisplay />);
    expect(html).toMatch(/<button[^>]*data-row-clip-speaker=""/);
  });

  test('the decorative speaker does not', () => {
    const html = renderToStaticMarkup(
      <CircularAudioProgressAnimatedSpeakerDisplay interactive={false} />,
    );
    expect(html).not.toContain('data-row-clip-speaker');
  });
});
```

- [ ] **Step 2: Run it and see the first test fail.**
      Run: `bun run test src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.test.tsx`
      Expected: FAIL, "the interactive speaker carries data-row-clip-speaker"; the second passes.

- [ ] **Step 3: Add the marker.** In the interactive return, add one attribute to the `<button>`:

```tsx
    <button
      type="button"
      aria-label={label}
      title={label}
      className={baseClass}
      style={targetStyle}
      onClick={handleClick}
      // E62: the row-clip helper presses the row's speaker by this marker.
      data-row-clip-speaker=""
    >
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.tsx src/components/audio/CircularAudioProgressAnimatedSpeakerDisplay.test.tsx
git commit -m "feat(audio): mark the speaker button for row clicks (E62)"
```

---

### Task 2: The shared helper

**Files:**

- Create: `src/audio/row-clip.ts`
- Test: `src/audio/row-clip.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `src/audio/row-clip.test.ts`:

```ts
// @vitest-environment happy-dom
/**
 * row-clip.test.ts — when a click on a row plays the row's clip (E62).
 * Spec: docs/specs/2026-11-12-row-click-audio-design.md §4.
 */
import type { MouseEvent } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { playRowClip, shouldPlayRowClip } from './row-clip';

afterEach(() => {
  document.body.innerHTML = '';
});

const SPEAKER = '<button type="button" data-row-clip-speaker="">speaker</button>';

/** A row in the document; `played` counts presses of its marked speaker. */
function makeRow(inner: string, outer = (row: string) => row) {
  document.body.innerHTML = outer(`<li id="row">${inner}</li>`);
  const row = document.getElementById('row');
  if (row === null) throw new Error('no row');
  const played = vi.fn();
  row.querySelector('[data-row-clip-speaker]')?.addEventListener('click', played);
  return { row, played };
}

function clickRow(row: HTMLElement, target: Element): void {
  playRowClip({ currentTarget: row, target } as unknown as MouseEvent<HTMLElement>);
}

describe('playRowClip', () => {
  test('a click on the row text presses the speaker', () => {
    const { row, played } = makeRow(`${SPEAKER}<p id="text">la casa</p>`);
    clickRow(row, row.querySelector('#text') as Element);
    expect(played).toHaveBeenCalledTimes(1);
  });

  test('a click on the row itself presses the speaker', () => {
    const { row, played } = makeRow(SPEAKER);
    clickRow(row, row);
    expect(played).toHaveBeenCalledTimes(1);
  });

  test('presses the marked speaker, not the first button', () => {
    const { row, played } = makeRow(
      `<button type="button" id="tile">tile</button>${SPEAKER}<p id="text">x</p>`,
    );
    const tile = vi.fn();
    row.querySelector('#tile')?.addEventListener('click', tile);
    clickRow(row, row.querySelector('#text') as Element);
    expect(played).toHaveBeenCalledTimes(1);
    expect(tile).not.toHaveBeenCalled();
  });

  test('a row with no marked speaker does nothing', () => {
    const { row } = makeRow('<button type="button" id="b">b</button><p id="text">x</p>');
    const b = vi.fn();
    row.querySelector('#b')?.addEventListener('click', b);
    clickRow(row, row.querySelector('#text') as Element);
    expect(b).not.toHaveBeenCalled();
  });
});

describe('shouldPlayRowClip', () => {
  test.each([
    ['the speaker itself', '<span id="t">x</span>', '[data-row-clip-speaker]'],
    ['a button', '<button type="button" id="t">x</button>', '#t'],
    ['a link', '<a href="#x" id="t">x</a>', '#t'],
    ['a text box', '<input id="t" />', '#t'],
    ['a dropdown', '<select id="t"><option>x</option></select>', '#t'],
    ['a text area', '<textarea id="t"></textarea>', '#t'],
    ['a label', '<label id="t">x</label>', '#t'],
    ['a draggable tile', '<span draggable="true" id="t">x</span>', '#t'],
    ['a combobox', '<div role="combobox" id="t">x</div>', '#t'],
    ['text inside a button', '<button type="button"><span id="t">x</span></button>', '#t'],
  ])('a click on %s does not play', (_name, inner, selector) => {
    const { row } = makeRow(`${SPEAKER}${inner}`);
    expect(shouldPlayRowClip(row.querySelector(selector), row, '')).toBe(false);
  });

  test('a control OUTSIDE the row does not stop it', () => {
    const { row } = makeRow(
      `${SPEAKER}<p id="t">x</p>`,
      (inner) => `<div role="option">${inner}</div>`,
    );
    expect(shouldPlayRowClip(row.querySelector('#t'), row, '')).toBe(true);
  });

  test('selected text does not play', () => {
    const { row } = makeRow(`${SPEAKER}<p id="t">la casa</p>`);
    expect(shouldPlayRowClip(row.querySelector('#t'), row, 'la casa')).toBe(false);
  });

  test('a target outside the row does not play', () => {
    const { row } = makeRow(SPEAKER);
    const elsewhere = document.createElement('p');
    document.body.append(elsewhere);
    expect(shouldPlayRowClip(elsewhere, row, '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/audio/row-clip.test.ts`
      Expected: FAIL, cannot resolve `./row-clip`.

- [ ] **Step 3: Write the helper.** Create `src/audio/row-clip.ts`:

```ts
/**
 * row-clip.ts — tap anywhere on a row to hear its clip (E62).
 *
 * A row that carries its own clip plays it when clicked or tapped anywhere on the row,
 * not only on the speaker. The row PRESSES its own speaker button rather than playing
 * the clip itself: the speaker already owns playback (what is playing, the progress
 * ring, stopping every other clip), so a second entry point into the audio layer would
 * be a second source of truth for the same fact. Ported from the vocabulary block's
 * `playRowClip`, itself from french-lo-1's `PhraseTable`.
 *
 * A MOUSE AND TOUCH CONVENIENCE ONLY. The row gets no role, tabIndex or key handler:
 * the speaker <button> is the keyboard and screen-reader path, and a second tab stop
 * per row would announce every word twice for nothing.
 *
 * Spec: docs/specs/2026-11-12-row-click-audio-design.md.
 */
import type { MouseEvent } from 'react';

/** Set on the speaker <button> (CircularAudioProgressAnimatedSpeakerDisplay). */
export const ROW_CLIP_SPEAKER_ATTRIBUTE = 'data-row-clip-speaker';

/**
 * The look of a row with a clip. A row WITHOUT one gets neither: a pointer over a row
 * that does nothing is a promise the page cannot keep.
 */
export const ROW_CLIP_CLASSES =
  'cursor-pointer transition-colors hover:bg-muted motion-reduce:transition-none';

/** Anything inside a row that does its own job when clicked. */
const CONTROL_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[draggable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="option"]',
  '[role="slider"]',
].join(',');

/**
 * Whether a click on `target` inside `row` should play the row's clip.
 *
 * No when: the row has no marked speaker; the target is not in the row; text is
 * selected (a drag to select a sentence ends in a click, and a plain click has already
 * collapsed any old selection on mousedown); or the click landed on a control INSIDE
 * the row. The containment check matters: a row can sit inside a focusable or
 * interactive ancestor, which must not swallow every click on it.
 */
export function shouldPlayRowClip(
  target: EventTarget | null,
  row: Element,
  selectedText: string,
): boolean {
  if (selectedText !== '') return false;
  if (row.querySelector(`[${ROW_CLIP_SPEAKER_ATTRIBUTE}]`) === null) return false;
  if (!(target instanceof Element) || !row.contains(target)) return false;
  const control = target.closest(CONTROL_SELECTOR);
  return control === null || control === row || !row.contains(control);
}

/** A row's `onClick`: press the row's own speaker when §4 of the spec allows it. */
export function playRowClip(event: MouseEvent<HTMLElement>): void {
  const row = event.currentTarget;
  const selectedText = window.getSelection()?.toString() ?? '';
  if (!shouldPlayRowClip(event.target, row, selectedText)) return;
  row.querySelector<HTMLElement>(`[${ROW_CLIP_SPEAKER_ATTRIBUTE}]`)?.click();
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS, 17 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/audio/row-clip.ts src/audio/row-clip.test.ts
git commit -m "feat(audio): a shared helper that plays a row's clip from anywhere on the row (E62)"
```

---

### Task 3: The vocabulary block uses the helper

**Files:**

- Modify: `src/lo/blocks/VocabularyBlock.tsx` (delete `playRowClip` at lines 30–47; the row at lines 114–133)
- Create: `src/lo/blocks/VocabularyBlock.row-clip.test.tsx`

- [ ] **Step 1: Write the failing test.** Create `src/lo/blocks/VocabularyBlock.row-clip.test.tsx`:

```tsx
// @vitest-environment happy-dom
/**
 * VocabularyBlock.row-clip.test.tsx — a click on a row with a clip presses its speaker
 * through the shared helper (E62); a row without a clip is not a row-clip row.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { VocabularyBlock } from './VocabularyBlock';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <VocabularyBlock
        content={{
          items: [
            { term: 'la casa', gloss: 'the house', audio: 'audio/lo-00-example/placeholder.m4a' },
            { term: 'el perro', gloss: 'the dog' },
          ],
        }}
      />,
    ),
  );
  return container;
}

test('a click on the gloss presses the row speaker', () => {
  const container = mount();
  const rows = container.querySelectorAll('[data-row-clip]');
  expect(rows).toHaveLength(1);
  const row = rows[0] as HTMLElement;
  const played = vi.fn();
  row.querySelector('[data-row-clip-speaker]')?.addEventListener('click', played);

  act(() => (row.querySelector('dd') as HTMLElement).click());

  expect(played).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run it and see it fail.**
      Run: `bun run test src/lo/blocks/VocabularyBlock.row-clip.test.tsx`
      Expected: FAIL, `expected [] to have a length of 1` (no `data-row-clip` yet).

- [ ] **Step 3: Use the helper.** In `VocabularyBlock.tsx`:
  1. Delete the `playRowClip` function and its doc comment (lines 30–47) and the now-unused `type MouseEvent` import (`import { useState } from 'react';` stays).
  2. Add `import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';`.
  3. Replace the row `<div>` (keep the long comment above it, and change its last line to point to the helper):

```tsx
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- mouse-only enhancement over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
          <div
            key={item.term}
            onClick={item.audio === undefined ? undefined : playRowClip}
            data-row-clip={item.audio === undefined ? undefined : ''}
            className={`grid gap-x-6 rounded-md sm:col-span-2 sm:grid-cols-subgrid ${
              item.audio === undefined ? '' : ROW_CLIP_CLASSES
            }`}
          >
```

- [ ] **Step 4: Run the vocabulary tests.**
      Run: `bun run test src/lo/blocks`
      Expected: PASS, including the existing `VocabularyBlock.test.tsx`.

- [ ] **Step 5: Commit.**

```bash
git add src/lo/blocks/VocabularyBlock.tsx src/lo/blocks/VocabularyBlock.row-clip.test.tsx
git commit -m "refactor(vocabulary): play a row's clip through the shared row-clip helper (E62)"
```

---

### Task 4: One mounted test per exercise (all failing first)

**Files:**

- Create: `src/exercises/lib/row-clip-engines.test.tsx`

- [ ] **Step 1: Write the tests.** Create `src/exercises/lib/row-clip-engines.test.tsx`. Each case mounts an engine with per-row audio, checks a click on the row presses its speaker, and checks a click on the row's own control (text box, tile, word, dropdown) does not. The three engines whose fixtures have no audio get a small config of their own.

```tsx
// @vitest-environment happy-dom
/**
 * row-clip-engines.test.tsx — in every exercise whose rows carry their own clip, a click
 * on the row plays it and a click on the row's own control does not (E62).
 * Spec: docs/specs/2026-11-12-row-click-audio-design.md §5–6.
 */
import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ExerciseComponentProps } from '@/exercises/lazy-registry';
import DictationExercise from '@/exercises/dictation/DictationExercise';
import { dictationFixtures } from '@/exercises/dictation/dictation.fixture';
import DragFillGapsExercise from '@/exercises/drag-fill-gaps/DragFillGapsExercise';
import InlineTypedGapExercise from '@/exercises/inline-gap/InlineTypedGapExercise';
import { inlineGapFixtures } from '@/exercises/inline-gap/inline-gap.fixture';
import LineMatchExercise from '@/exercises/line-match/LineMatchExercise';
import PhraseReorderExercise from '@/exercises/phrase-reorder/PhraseReorderExercise';
import { phraseReorderFixtures } from '@/exercises/phrase-reorder/phrase-reorder.fixture';
import WordSpotExercise from '@/exercises/word-spot/WordSpotExercise';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

const CLIP = 'audio/showcase-demo/inline-gap/q1.wav';

const fixture = (list: readonly { id: string; config: unknown }[], id: string): unknown => {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no fixture ${id}`);
  return found.config;
};

/** [name, engine, config, selector of the control inside a row that must NOT play] */
const CASES: [string, ComponentType<ExerciseComponentProps>, unknown, string][] = [
  [
    'inline-gap, independent clips',
    InlineTypedGapExercise,
    fixture(inlineGapFixtures, 'inline-gap-audio'),
    'input',
  ],
  [
    'inline-gap, master playlist',
    InlineTypedGapExercise,
    fixture(inlineGapFixtures, 'inline-gap-master'),
    'input',
  ],
  ['text-entry (dictation)', DictationExercise, dictationFixtures[0]?.config, 'input'],
  [
    'phrase-reorder',
    PhraseReorderExercise,
    phraseReorderFixtures[0]?.config,
    'button:not([data-row-clip-speaker])',
  ],
  [
    'drag-fill-gaps',
    DragFillGapsExercise,
    {
      type: 'drag-fill-gaps',
      content: { items: [{ text: 'Yo [soy] y ella [vive].', audio: CLIP }] },
    },
    'button:not([data-row-clip-speaker])',
  ],
  [
    'word-spot',
    WordSpotExercise,
    { type: 'word-spot', content: { items: [{ text: 'El [ch]ico [ch]ileno.', audio: CLIP }] } },
    'button:not([data-row-clip-speaker])',
  ],
  [
    'line-match (phone layout)',
    LineMatchExercise,
    {
      type: 'line-match',
      content: {
        items: [
          {
            id: 'a',
            label: 'el círculo',
            image: 'images/line-match/circle.svg',
            localLanguage: 'circle',
            audio: CLIP,
          },
          {
            id: 'b',
            label: 'el cuadrado',
            image: 'images/line-match/square.svg',
            localLanguage: 'square',
            audio: CLIP,
          },
        ],
      },
    },
    '[role="combobox"], button:not([data-row-clip-speaker])',
  ],
];

function mount(Engine: ComponentType<ExerciseComponentProps>, config: unknown): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Engine config={config as ExerciseComponentProps['config']} />));
  return container;
}

function firstRow(container: HTMLElement) {
  const row = container.querySelector<HTMLElement>('[data-row-clip]');
  if (row === null) throw new Error('no [data-row-clip] row rendered');
  const played = vi.fn();
  row.querySelector('[data-row-clip-speaker]')?.addEventListener('click', played);
  return { row, played };
}

describe.each(CASES)('%s', (_name, Engine, config, controlSelector) => {
  test('a click on the row presses its speaker', () => {
    const { row, played } = firstRow(mount(Engine, config));
    act(() => row.click());
    expect(played).toHaveBeenCalledTimes(1);
  });

  test("a click on the row's own control does not play", () => {
    const { row, played } = firstRow(mount(Engine, config));
    const control = row.querySelector<HTMLElement>(controlSelector);
    if (control === null) throw new Error(`no ${controlSelector} in the row`);
    act(() => control.click());
    expect(played).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and see every case fail.**
      Run: `bun run test src/exercises/lib/row-clip-engines.test.tsx`
      Expected: FAIL, 14 tests, each with "no [data-row-clip] row rendered". Note what a failure
      says if it is anything else: a bad fixture id or config fails here, before any engine changes.

- [ ] **Step 3: Commit the failing test? No.** Leave it uncommitted; Tasks 5–10 each make two of its tests pass, and Task 10 commits it with the last engine.

---

### Tasks 5–10: Wire each engine (one task each)

Every engine gets the same three things on the row element, only when that row has a clip:
`onClick={playRowClip}`, `data-row-clip=""`, and `ROW_CLIP_CLASSES` merged into its classes.
Add `import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';` to each file, and
`import { cn } from '@/lib/utils';` to the five that merge classes with it (inline-gap,
phrase-reorder, drag-fill-gaps, word-spot, line-match) unless the file already imports it.
`text-entry` needs no `cn`: `TableRow` merges `className` itself.

**The lint comment.** After each edit, run `bun run lint -- <file>`. `jsx-a11y` reports a click
handler on a non-interactive element under a rule that depends on the element: usually
`jsx-a11y/no-static-element-interactions` for a `<div>` or `<span>`, and
`jsx-a11y/no-noninteractive-element-interactions` for an `<li>` or `<tr>`, each with
`jsx-a11y/click-events-have-key-events`. Put exactly the rules it reports on one line above the
element:

```tsx
// eslint-disable-next-line <the rules lint reported> -- mouse-only enhancement over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
```

If lint reports nothing for an element (a component like `TableRow` is not checked), add no
comment: an unused disable fails lint.

After each task, run `bun run test src/exercises/lib/row-clip-engines.test.tsx` and expect the
two tests for that engine to PASS, and the others still to fail.

#### Task 5: inline-gap (both audio modes)

**File:** `src/exercises/inline-gap/InlineTypedGapExercise.tsx`, the row pushed in `rows.push(` (about line 266).

- [ ] **Step 1: Wire the row.** `item.audio` is the row's clip:

```tsx
    rows.push(
      // eslint-disable-next-line <rules lint reports> -- mouse-only enhancement over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
      <div
        key={`row-${i}`}
        onClick={item.audio ? playRowClip : undefined}
        data-row-clip={item.audio ? '' : undefined}
        className={cn(
          'rounded-lg border border-border/70 bg-card px-4 py-3 leading-loose',
          item.audio && ROW_CLIP_CLASSES,
        )}
      >
```

Both audio modes render their speaker through `CircularAudioProgressAnimatedSpeakerDisplay`
(master mode passes `handleClick={() => audio.playRow(rowIndex)}`), so the marker from Task 1
covers both.

- [ ] **Step 2: Lint, then run the engines test.** Expected: both inline-gap cases (4 tests) PASS.
- [ ] **Step 3: Commit.** `git add src/exercises/inline-gap/InlineTypedGapExercise.tsx && git commit -m "feat(inline-gap): play a row's clip from anywhere on the row (E62)"`

#### Task 6: text-entry (dictation and typed-transform)

**File:** `src/exercises/text-entry/TextEntryRuntime.tsx`, the `<TableRow key={`row-${rowIndex}`}>` (about line 161).

- [ ] **Step 1: Wire the row.** `row.audio` is the clip. `TableRow` merges `className` with `cn`:

```tsx
      <TableRow
        key={`row-${rowIndex}`}
        onClick={row.audio ? playRowClip : undefined}
        data-row-clip={row.audio ? '' : undefined}
        className={row.audio ? ROW_CLIP_CLASSES : undefined}
      >
```

- [ ] **Step 2: Lint, then run the engines test.** Expected: the text-entry case PASSES.
- [ ] **Step 3: Commit.** `git add src/exercises/text-entry/TextEntryRuntime.tsx && git commit -m "feat(text-entry): play a row's clip from anywhere on the row (E62)"`

#### Task 7: phrase-reorder

**File:** `src/exercises/phrase-reorder/PhraseReorderExercise.tsx`, the slot `<li>` (about line 274).

- [ ] **Step 1: Wire the row.** `row.audio` is the clip:

```tsx
            <li
              key={`slot-${index}`}
              className={cn('phrase-reorder-row', row.audio && ROW_CLIP_CLASSES)}
              data-has-prompt={showPromptColumn}
              onClick={row.audio ? playRowClip : undefined}
              data-row-clip={row.audio ? '' : undefined}
            >
```

The phrase tokens are `<button>`s (click to select, drag to move), so a click on one is a
control and does not play.

- [ ] **Step 2: Lint, then run the engines test.** Expected: the phrase-reorder case PASSES.
- [ ] **Step 3: Commit.** `git add src/exercises/phrase-reorder/PhraseReorderExercise.tsx && git commit -m "feat(phrase-reorder): play a row's clip from anywhere on the row (E62)"`

#### Task 8: drag-fill-gaps

**File:** `src/exercises/drag-fill-gaps/DragFillGapsExercise.tsx`, the row `<li>` (about line 307).

- [ ] **Step 1: Wire the row.**

```tsx
          <li
            className={cn('drag-fill-gaps-row', row.audio && ROW_CLIP_CLASSES)}
            key={`row-${rowIndex}`}
            onClick={row.audio ? playRowClip : undefined}
            data-row-clip={row.audio ? '' : undefined}
          >
```

- [ ] **Step 2: Lint, then run the engines test.** Expected: the drag-fill-gaps case PASSES.
- [ ] **Step 3: Commit.** `git add src/exercises/drag-fill-gaps/DragFillGapsExercise.tsx && git commit -m "feat(drag-fill-gaps): play a row's clip from anywhere on the row (E62)"`

#### Task 9: word-spot

**File:** `src/exercises/word-spot/WordSpotExercise.tsx`, the row `<li>` (about line 99).

- [ ] **Step 1: Wire the row.**

```tsx
          <li
            className={cn('word-spot-row', row.audio && ROW_CLIP_CLASSES)}
            key={`row-${rowIndex}`}
            onClick={row.audio ? playRowClip : undefined}
            data-row-clip={row.audio ? '' : undefined}
          >
```

The spottable words are buttons, so a click on a word marks it and does not play; a click on
the space between words plays.

- [ ] **Step 2: Lint, then run the engines test.** Expected: the word-spot case PASSES.
- [ ] **Step 3: Commit.** `git add src/exercises/word-spot/WordSpotExercise.tsx && git commit -m "feat(word-spot): play a row's clip from anywhere on the row (E62)"`

#### Task 10: line-match (phone layout)

**File:** `src/exercises/line-match/LineMatchExercise.tsx`, `renderMobileRow`'s `<li>` (about line 368). The desktop layout renders no per-row clip and is unchanged.

- [ ] **Step 1: Wire the row.**

```tsx
      <li
        className={cn(
          'flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3',
          item.audio && ROW_CLIP_CLASSES,
        )}
        key={`line-match-row-${key}`}
        onClick={item.audio ? playRowClip : undefined}
        data-row-clip={item.audio ? '' : undefined}
      >
```

- [ ] **Step 2: Lint, then run the engines test.**
      Run: `bun run test src/exercises/lib/row-clip-engines.test.tsx`
      Expected: PASS, all 14 tests.
- [ ] **Step 3: Commit the engine and the engines test together.**

```bash
git add src/exercises/line-match/LineMatchExercise.tsx src/exercises/lib/row-clip-engines.test.tsx
git commit -m "feat(line-match): play a row's clip from anywhere on the row on phones (E62)"
```

---

### Task 11: Browser test at phone size

**Files:**

- Modify: `e2e/debug/showcase-audio.spec.ts`

- [ ] **Step 1: Write the test.** Append (it reuses `recordPlayback`, `mediaLog`, `CLIP`, `card` and `openShowcase` from the same file):

```ts
test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('a tap anywhere on a row plays its clip; a tap on its text box does not (E62)', async ({
    page,
  }) => {
    await recordPlayback(page);
    await openShowcase(page);
    const row = card(page, 'inline-gap-audio').locator('[data-row-clip]').first();

    await row.locator('input').first().tap();
    await expect(row.locator('input').first()).toBeFocused();
    expect(await mediaLog(page)).toEqual([]);

    await row.getByText('de Madrid.').tap();
    await expect
      .poll(() => mediaLog(page))
      .toEqual([expect.stringMatching(`^playing .*${CLIP}$`), expect.stringMatching(`^ended `)]);
  });
});
```

- [ ] **Step 2: Build the debug pages and run the suite.**
      Run: `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e -- e2e/debug/showcase-audio.spec.ts`
      Expected: PASS in all three browsers. If `getByText('de Madrid.')` matches nothing, read the
      row's text in the fixture (`inline-gap.fixture.ts`, the `inline-gap-audio` entry: "Yo
      [soy::ser] de Madrid.") and target the text segment after the gap.
- [ ] **Step 3: Commit.** `git add e2e/debug/showcase-audio.spec.ts && git commit -m "test(e2e): a tap on a row plays its clip at phone size (E62)"`

---

### Task 12: Docs and the full gate

**Files:**

- Modify: `docs/STYLE.md`, `CONTRIBUTING.md`, `docs/process/TODO.md`, the spec's status line

- [ ] **Step 1: Re-read each doc immediately before editing it** (Prettier reflows tables).

- [ ] **Step 2: `docs/STYLE.md`.** Under "Habits nothing enforces", add a short subsection:

```markdown
### A row with its own clip

A row that carries its own recording plays it when clicked or tapped anywhere on the row,
through `src/audio/row-clip.ts` (`onClick={playRowClip}`, `data-row-clip`, `ROW_CLIP_CLASSES`),
never a copy of it. The speaker stays the keyboard path; the row gets no role or tab stop.
Flashcards and memory match are the exception: a tap there turns the card over. Spec:
[`docs/specs/2026-11-12-row-click-audio-design.md`](specs/2026-11-12-row-click-audio-design.md).
```

- [ ] **Step 3: `CONTRIBUTING.md`.** In the exercise-engine note (the paragraph beginning "Note: adding a new **exercise engine**"), add one sentence at its end:

```markdown
> An engine whose rows each carry a clip plays it from anywhere on the row with
> `src/audio/row-clip.ts` (`docs/STYLE.md`, "A row with its own clip").
```

- [ ] **Step 4: `docs/process/TODO.md`.** Add a dated "Latest" paragraph at the top of the log for E62: what changed (six engines and the vocabulary block, one helper, flashcards and memory match unchanged), the branch and the test counts from Step 6, and **Next:** the pull request, then the courses take it with the next template update; then the vocabulary word bank (template issue 108) reuses the helper.

- [ ] **Step 5: The spec's status line.** In `docs/specs/2026-11-12-row-click-audio-design.md`, set `**Status:** built 2026-11-12 (TODO §E62)` and `**Plan:** [`2026-11-12-row-click-audio-plan.md`](../process/2026-11-12-row-click-audio-plan.md)`. Add a "Deviations from this spec" note recording the `data-row-clip` attribute.

- [ ] **Step 6: Run the full gate** (`AGENTS.md`):

```bash
bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e
```

Then the debug suite, since this change touches what a debug page shows:

```bash
DEBUG=1 bun run build && DEBUG=1 bun run test:e2e
```

Expected: everything green. A coverage bar below its threshold on `row-clip.ts` means a branch
in `shouldPlayRowClip` is untested; add the case to `row-clip.test.ts`, not an exclusion.

- [ ] **Step 7: Commit.**

```bash
git add docs/STYLE.md CONTRIBUTING.md docs/process/TODO.md docs/specs/2026-11-12-row-click-audio-design.md
git commit -m "docs: record tap-anywhere-on-a-row audio (E62)"
```

- [ ] **Step 8: Hand back for the pull request.** Do not push or open the pull request without the maintainer's go-ahead; the `before-pr` skill walks the checklist.
