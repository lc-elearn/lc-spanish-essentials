# Exercises in tabs (E57) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** a lesson section's `exercises` list may hold an **exercise set** (one accordion, one
instruction box, then tabs that each hold one exercise folder), shown in `lo-00-example` and on
the exercise showcase, with every engine proven to work in a tab.

**Architecture:** the set is a strict Zod object beside the plain refs in `LoSectionSchema`;
`assembleLo` resolves its tabs to ordinary exercise configs; `lo-page-sections.tsx` renders it as
`LoAccordion` → `ExerciseSetBody`, which reuses the tab UI pulled out of `TabsBlock` into a shared
`TabSet`, `MediaPanel` for tab audio and `ExerciseHost` for each exercise.

**Tech stack:** React 19, Base UI tabs (vendored shadcn), Zod 4, Vitest, Playwright, Bun.

**Spec:** [`../specs/2026-11-11-tab-exercises-design.md`](../specs/2026-11-11-tab-exercises-design.md)
(decisions S1–S8). Branch `feat/e57-tab-exercises`, cut from `main` at `bf016ac`.

**Rules that apply to every task** (from [`AGENTS.md`](../../AGENTS.md); read it first):
`bun run test`, never `bun test`. Write the test, run it, see it fail for the expected reason,
then write the code. Tokens only, every CSS rule in `@layer`, no `!important`. Prerendered
markup equals the first client render. Commit per task with a Conventional Commit message
ending in the attribution line the session gives you. The full gate runs before every commit
(AGENTS.md, "Verify before you claim done"); in the middle of the work, run at least
`bun run format && bun run lint && bun run test` and run the whole gate before pushing.

---

## Files

| File                                                | Change                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/lo/blocks/media-schema.ts`                     | shared rules as a pure function; new `SetTabMediaSchema` (transcript optional) |
| `src/lo/blocks/MediaPanel.tsx`                      | the player renders alone when there is no transcript                           |
| `src/exercises/lib/instructions.ts`                 | `resolveSetInstructions`; `resolveInstructions` gains `useDefault`             |
| `src/exercises/lib/ExerciseHost.tsx`                | `defaultInstructions` prop                                                     |
| `src/components/shell/TabSet.tsx` (new)             | the tab row, the narrow dropdown and the kept-mounted panels                   |
| `src/lo/blocks/TabsBlock.tsx`                       | renders through `TabSet`                                                       |
| `src/lo/ExerciseSet.tsx` (new)                      | `ExerciseSetBody`: the box above the tabs, then `TabSet` of media + exercise   |
| `src/config/lo-schema.ts`                           | `ExerciseSetSchema`, section `exercises` union, once-per-lesson rule           |
| `src/guards/render-mirror.ts`                       | collects the refs inside a set                                                 |
| `src/lo/assemble-lo.ts`                             | `AssembledExerciseSet`, `isExerciseSet`, set refusals                          |
| `src/lo/lo-page-sections.tsx`                       | renders a set                                                                  |
| `lo-config/lo-00-example/…`                         | the set, `exercises/03-drag-fill-gaps/`, `exercises/04-inline-choice/`         |
| `src/showcase/exercise-sets.ts` (new)               | the two showcase set cards                                                     |
| `src/showcase/Showcase.tsx`, `showcase-sections.ts` | render and list the set cards                                                  |
| `e2e/exercise-set.spec.ts` (new)                    | the example's set in three browsers                                            |
| `e2e/debug/exercise-set-engines.spec.ts` (new)      | every engine in a tab                                                          |
| docs                                                | CONTRIBUTING, llms.txt, STRUCTURE, COURSE_GUIDE (if needed), TODO, the specs   |

---

### Task 1: Tab media may have audio without a transcript (S5)

**Files:** modify `src/lo/blocks/media-schema.ts`, `src/lo/blocks/MediaPanel.tsx`; test
`src/lo/blocks/media-schema.test.ts`, `src/lo/blocks/MediaPanel.test.tsx`.

- [ ] **Step 1: Failing tests.** Append to `media-schema.test.ts` (add `SetTabMediaSchema` to its
      import from `./media-schema`):

```ts
const setAudio = { src: 'audio/lo-00-example/placeholder.m4a' };

test('a set tab takes audio without a transcript; a tabs-block tab does not (E57 S5)', () => {
  expect(SetTabMediaSchema.safeParse({ audio: setAudio }).success).toBe(true);
  expect(MediaSchema.safeParse({ audio: setAudio }).success).toBe(false);
});

test('a set tab keeps every other media rule', () => {
  const figure = { kind: 'figure', src: 'images/x/chart.svg', alt: 'Visits peak on Saturday' };
  // A transcript still needs audio.
  expect(SetTabMediaSchema.safeParse({ image: figure, transcript: ['Words.'] }).success).toBe(
    false,
  );
  // An empty group, and a figure without alt, still fail.
  expect(SetTabMediaSchema.safeParse({}).success).toBe(false);
  expect(SetTabMediaSchema.safeParse({ image: { ...figure, alt: '' } }).success).toBe(false);
});
```

Append to `MediaPanel.test.tsx` (add `SetTabMediaSchema` to its import):

```tsx
test('audio without a transcript renders the player and no toggle (E57 S5)', () => {
  const html = renderToStaticMarkup(<MediaPanel media={SetTabMediaSchema.parse({ audio })} />);

  expect(html).toContain('<audio');
  expect(html).toContain('Listen to Claire');
  expect(html).not.toContain('<details');
});
```

- [ ] **Step 2:** `bun run test src/lo/blocks` — FAIL: `SetTabMediaSchema` is not exported.

- [ ] **Step 3: Implement.** In `media-schema.ts`, replace the `MediaSchema` definition with a
      shape, a pure rule function and two schemas. Keep the header; add to it one paragraph:
      "A SET TAB'S MEDIA (E57, spec S5) keeps every rule but one: audio may come without a
      transcript, because the exercise's own lines are the text and Show answers fills the gaps."

```ts
const MediaShape = z.strictObject({
  image: MediaImageSchema.optional(),
  audio: MediaAudioSchema.optional(),
  /** What the audio says, one entry per paragraph. */
  transcript: RichTextEntriesSchema.optional(),
});

interface MediaIssue {
  readonly path: (string | number)[];
  readonly message: string;
}

/** Every rule a media group keeps; `transcriptRequired` is the tabs block's audio rule. */
function mediaIssues(media: z.infer<typeof MediaShape>, transcriptRequired: boolean): MediaIssue[] {
  const { image, audio, transcript } = media;
  const issues: MediaIssue[] = [];
  if (image === undefined && audio === undefined) {
    issues.push({ path: [], message: 'media needs an image, audio or both' });
  }
  if (transcriptRequired && audio !== undefined && transcript === undefined) {
    issues.push({
      path: ['transcript'],
      message: 'audio needs a transcript — a learner who cannot hear the clip reads it',
    });
  }
  if (audio === undefined && transcript !== undefined) {
    issues.push({ path: ['transcript'], message: 'a transcript needs audio to transcribe' });
  }
  if (image?.kind === 'figure' && image.alt.trim() === '') {
    issues.push({
      path: ['image', 'alt'],
      message: 'a figure carries information — its alt must state the takeaway',
    });
  }
  if (image?.kind === 'portrait' && image.caption !== undefined) {
    issues.push({ path: ['image', 'caption'], message: 'only a figure takes a caption' });
  }
  return issues;
}

/** A tabs-block tab's media: audio always comes with its transcript. */
export const MediaSchema = MediaShape.superRefine((media, ctx) => {
  for (const issue of mediaIssues(media, true)) ctx.addIssue({ code: 'custom', ...issue });
});
export type Media = z.infer<typeof MediaSchema>;

/** An exercise-set tab's media (E57 S5): audio may come without a transcript. */
export const SetTabMediaSchema = MediaShape.superRefine((media, ctx) => {
  for (const issue of mediaIssues(media, false)) ctx.addIssue({ code: 'custom', ...issue });
});
```

In `MediaPanel.tsx`, make the transcript optional in `Listening` and build the player whenever
there is audio:

```tsx
function Listening({
  audio,
  transcript,
  wide,
}: {
  audio: MediaAudio;
  /** Absent only in an exercise-set tab, where the exercise's lines are the text (E57). */
  transcript: readonly RichTextEntry[] | undefined;
  /** Lift the player's 28rem cap so it spans a figure above it. */
  wide: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className={cn('rich-text-player', wide && '[&_audio]:max-w-none')}>
        <AudioClip soundFile={audio.src} listenText={audio.label ?? ''} />
      </div>
      {transcript === undefined ? null : <Transcript entries={transcript} />}
    </div>
  );
}
```

and in `MediaPanel` replace the `listening` constant and its comment with:

```tsx
// The schemas decide whether audio needs a transcript; the panel shows what it is given.
const listening =
  audio === undefined ? null : (
    <Listening audio={audio} transcript={transcript} wide={image?.kind === 'figure'} />
  );
```

Add one line to `MediaPanel`'s header: "In an exercise-set tab the transcript may be absent
(E57); the player then renders alone."

- [ ] **Step 4:** `bun run test src/lo/blocks` — PASS (the existing media and tabs tests too).
- [ ] **Step 5: Commit** `feat: let an exercise-set tab play audio without a transcript (E57)`.

---

### Task 2: Instruction boxes for a set and its tabs (S2, S3)

**Files:** modify `src/exercises/lib/instructions.ts`, `src/exercises/lib/ExerciseHost.tsx`; test
`src/exercises/lib/instructions.test.ts`, `src/exercises/lib/ExerciseHost.test.tsx`.

- [ ] **Step 1: Failing tests.** Append to `instructions.test.ts` (import
      `resolveSetInstructions`, `resolveInstructions`, `EXERCISE_INSTRUCTIONS` from
      `./instructions` if not already imported):

```ts
describe('an exercise set (E57)', () => {
  test('its own instructions show above the tabs', () => {
    expect(resolveSetInstructions('Do both parts.', ['select', 'inline-choice'])).toBe(
      'Do both parts.',
    );
  });

  test('without them, tabs of one engine show that engine default copy (S2)', () => {
    expect(resolveSetInstructions(undefined, ['drag-fill-gaps', 'drag-fill-gaps'])).toBe(
      EXERCISE_INSTRUCTIONS['drag-fill-gaps'],
    );
  });

  test('tabs of different engines have no default, so the loader must refuse (S2)', () => {
    expect(resolveSetInstructions(undefined, ['select', 'inline-choice'])).toBeNull();
  });

  test('in a tab, only the exercise own instructions show (S3)', () => {
    expect(resolveInstructions('select', undefined, { useDefault: false })).toBeNull();
    expect(resolveInstructions('select', 'Listen first.', { useDefault: false })).toBe(
      'Listen first.',
    );
  });
});
```

(Use `describe`/`test` as that file already does; add `describe` to its `vitest` import if
missing.) Append to `ExerciseHost.test.tsx` (import `EXERCISE_INSTRUCTIONS` from
`./instructions`):

```tsx
describe('ExerciseHost in a set tab (E57 S3)', () => {
  test('shows no box when the exercise wrote no instructions', () => {
    const html = renderToStaticMarkup(
      <ExerciseHost type="select" config={CONFIG} defaultInstructions={false} />,
    );

    expect(html).not.toContain(EXERCISE_INSTRUCTIONS.select.slice(0, 30));
    expect(html).not.toContain('role="note"');
  });

  test('shows the box the exercise wrote', () => {
    const config = { ...CONFIG, content: { instructions: 'Listen to dialogue 1 first.' } };
    const html = renderToStaticMarkup(
      <ExerciseHost type="select" config={config} defaultInstructions={false} />,
    );

    expect(html).toContain('Listen to dialogue 1 first.');
  });
});
```

- [ ] **Step 2:** `bun run test src/exercises/lib` — FAIL: `resolveSetInstructions` missing,
      `useDefault` ignored, `defaultInstructions` unknown.

- [ ] **Step 3: Implement.** In `instructions.ts`, change `resolveInstructions`:

```ts
/**
 * …existing doc…
 * @param context  `savesProgress` adds SAVED_PROGRESS_INSTRUCTIONS to the default;
 *                 `useDefault: false` drops the default copy, leaving only an author's
 *                 own text (an exercise in a set's tab, E57 S3).
 */
export function resolveInstructions(
  type: ExerciseType,
  override?: string | null,
  context: { savesProgress?: boolean; useDefault?: boolean } = {},
): string | null {
  if (override === '' || override === null) return null;
  if (typeof override === 'string' && override.trim() !== '') return override;
  if (context.useDefault === false) return null;
  const copy = EXERCISE_INSTRUCTIONS[type];
  return context.savesProgress ? `${copy} ${SAVED_PROGRESS_INSTRUCTIONS}` : copy;
}

/**
 * The box above an exercise set's tabs (E57, spec S2): the set's own text, or, when every
 * tab uses one engine, that engine's default copy. Tabs of different engines share no
 * default, so this returns `null` and the loader refuses the set.
 */
export function resolveSetInstructions(
  instructions: string | undefined,
  types: readonly ExerciseType[],
): string | null {
  if (instructions !== undefined) return instructions;
  const [first, ...rest] = types;
  if (first === undefined || rest.some((type) => type !== first)) return null;
  return EXERCISE_INSTRUCTIONS[first];
}
```

In `ExerciseHost.tsx`, add to `ExerciseHostProps`:

```ts
  /**
   * false in an exercise set's tab (E57 S3): the box shows only when the exercise wrote
   * `content.instructions`, because the set's box above the tabs already says what to do.
   */
  defaultInstructions?: boolean;
```

destructure it as `defaultInstructions = true` and pass it on:

```ts
const instructions = resolveInstructions(type, readInstructionsOverride(config), {
  // An engine saves only when told where it lives (E13a), so promise nothing without.
  savesProgress: savesProgress(config) && progressId !== undefined,
  useDefault: defaultInstructions,
});
```

- [ ] **Step 4:** `bun run test src/exercises/lib` — PASS.
- [ ] **Step 5: Commit** `feat: resolve an exercise set's instruction box and hide a tab's default (E57)`.

---

### Task 3: Pull the tab UI out of TabsBlock into a shared TabSet

A refactor: the tabs block's look and roles do not change, and its tests stay as they are.

**Files:** create `src/components/shell/TabSet.tsx`, test `src/components/shell/TabSet.test.tsx`;
modify `src/lo/blocks/TabsBlock.tsx`.

- [ ] **Step 1: Failing test** `src/components/shell/TabSet.test.tsx`:

```tsx
/**
 * TabSet.test.tsx — the shared tab UI (E57): a named tab row, every panel in the
 * prerendered page, the inactive ones hidden.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TabSet } from './TabSet';

const TABS = [
  { key: 'a', label: 'Part 1', panel: <p>First panel</p> },
  { key: 'b', label: 'Part 2', panel: <p>Second panel</p> },
];

test('names the tab row and renders one tab per entry', () => {
  const html = renderToStaticMarkup(<TabSet label="Reconstruct the text" tabs={TABS} />);

  expect(html).toContain('role="tablist"');
  expect(html).toContain('aria-label="Reconstruct the text"');
  expect(html.split('role="tab"').length - 1).toBe(2);
  expect(html).toContain('>Part 1<');
  expect(html).toContain('>Part 2<');
});

test('prerenders every panel, the inactive one hidden', () => {
  const html = renderToStaticMarkup(<TabSet label="Parts" tabs={TABS} />);

  expect(html).toContain('<p>First panel</p>');
  expect(html).toContain('<p>Second panel</p>');
  expect(html.split('role="tabpanel"').length - 1).toBe(2);
  expect(html).toMatch(/hidden/);
});
```

- [ ] **Step 2:** `bun run test src/components/shell/TabSet` — FAIL: module not found.

- [ ] **Step 3: Implement.** Create `src/components/shell/TabSet.tsx`. Move into it, unchanged,
      from `TabsBlock.tsx`: the four class constants (`LIST_CLASSES`, `TRIGGER_CLASSES`,
      `SELECT_TRIGGER_CLASSES`, `PANEL_CLASSES`), the `value` state, and the `Tabs` / `Select` /
      `TabsList` / `TabsContent` markup. Move the header paragraphs about Base UI, `keepMounted`,
      the narrow dropdown, `@3xl` and `primary` too, since they now describe this file; leave
      `TabsBlock` a short header pointing here.

```tsx
/**
 * TabSet — labelled tabs, one panel showing at a time: the tabs block's UI (TODO §F1, §F3),
 * shared since E57 with the exercise set.
 *
 * [the moved paragraphs from TabsBlock's header: BUILT ON THE VENDORED shadcn `Tabs`…,
 *  `keepMounted`… (reword its last sentence: "…is what keeps a learner's answers in an
 *  exercise set when they switch tabs and back (E57)."), STYLING IS OVERRIDDEN HERE…,
 *  THE SWITCH IS `@3xl`…, THE RULES ARE `primary`…]
 *
 * Specs: docs/specs/2026-10-07-tabs-block-design.md §4, §5;
 *        docs/specs/2026-11-11-tab-exercises-design.md §5.
 */
import { useState, type ReactNode } from 'react';
import { FOCUS_OUTLINE } from '@/components/shell/focus-outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// [LIST_CLASSES, TRIGGER_CLASSES, SELECT_TRIGGER_CLASSES, PANEL_CLASSES moved verbatim]

/** One tab: a stable key, its visible label (also its name), and its panel. */
export interface TabSetTab {
  readonly key: string;
  readonly label: string;
  readonly panel: ReactNode;
}

interface TabSetProps {
  /** The tab row's accessible name (and the narrow dropdown's). */
  label: string;
  tabs: readonly TabSetTab[];
}

export function TabSet({ label, tabs }: TabSetProps) {
  // Values are the tab's index: stable, because tabs are static config.
  const [value, setValue] = useState('0');

  return (
    // Its own container: "wide" is this set's width, not the viewport's.
    <div className="@container">
      <Tabs value={value} onValueChange={(next: string) => setValue(next)} className="gap-0">
        <div className="@3xl:hidden">
          <Select
            value={value}
            onValueChange={(next: string | null) => {
              if (next !== null) setValue(next);
            }}
          >
            <SelectTrigger aria-label={label} className={SELECT_TRIGGER_CLASSES}>
              <SelectValue>{(chosen: string) => tabs[Number(chosen)]?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab, index) => (
                <SelectItem key={tab.key} value={String(index)}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsList aria-label={label} activateOnFocus className={LIST_CLASSES}>
          {tabs.map((tab, index) => (
            <TabsTrigger key={tab.key} value={String(index)} className={TRIGGER_CLASSES}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab, index) => (
          <TabsContent key={tab.key} value={String(index)} keepMounted className={PANEL_CLASSES}>
            {tab.panel}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

Then `TabsBlock.tsx` becomes:

```tsx
/**
 * TabsBlock — `type: "tabs"`: labelled tabs, one panel showing at a time, each panel the
 * same rich text a grammar block takes. The tab UI itself is `TabSet`
 * (`src/components/shell/TabSet.tsx`), shared with the exercise set since E57.
 *
 * Each panel: the instruction box, then the tab's media, then its text.
 *
 * Spec: docs/specs/2026-10-07-tabs-block-design.md §4, §5.
 */
import InstructionsCallout from '@/components/shell/InstructionsCallout';
import { TabSet } from '@/components/shell/TabSet';
import { RichTextEntries } from '../rich-text/RichTextEntries';
import { MediaPanel } from './MediaPanel';
import { parseBlockContent } from './parse-block-content';
import { TabsBlockContentSchema } from './tabs-block-schema';

export function TabsBlock({ content }: { content: unknown }) {
  const { label, intro, tabs } = parseBlockContent('tabs', TabsBlockContentSchema, content);

  return (
    <div className="space-y-4">
      {intro === undefined ? null : (
        <div className="space-y-3">
          <RichTextEntries entries={intro} paragraphClassName="text-foreground" />
        </div>
      )}
      <TabSet
        label={label}
        tabs={tabs.map((tab) => ({
          key: tab.label,
          label: tab.label,
          panel: (
            <>
              {/* The accordions' instruction box, first in every panel. */}
              <InstructionsCallout className="mt-0 mb-3">{tab.instructions}</InstructionsCallout>
              {tab.media === undefined ? null : <MediaPanel media={tab.media} className="mb-4" />}
              <div className="space-y-3">
                <RichTextEntries entries={tab.text} paragraphClassName="text-foreground" />
              </div>
            </>
          ),
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 4:** `bun run test src/components src/lo src/guards` — PASS, `tabs-block.test.tsx`
      unchanged. If a guard (h, semantic DOM) or `source-negation.test.ts` names a file path for
      the tabs UI, point it at `TabSet.tsx` and say so in the commit body.
- [ ] **Step 5: Commit** `refactor: share the tabs block's tab UI as TabSet (E57)`.

---

### Task 4: The set's body: one box, then tabs of media and exercise

**Files:** create `src/lo/ExerciseSet.tsx`, test `src/lo/ExerciseSet.test.tsx`.

- [ ] **Step 1: Failing test** `src/lo/ExerciseSet.test.tsx`:

```tsx
/**
 * ExerciseSet.test.tsx — the exercise set's body (E57): one instruction box above a
 * tab row named by the set, each panel its media then its exercise, and a tab's own
 * box only when its exercise wrote one.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5 (S2, S3, S5).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { EXERCISE_INSTRUCTIONS } from '@/exercises/lib/instructions';
import { ExerciseSetBody, type ExerciseSetTabView } from './ExerciseSet';

const TABS: ExerciseSetTabView[] = [
  {
    id: '03-drag-fill-gaps',
    label: 'Part 1',
    type: 'drag-fill-gaps',
    config: {
      type: 'drag-fill-gaps',
      title: 'Part 1',
      content: { items: [{ text: 'Yo [soy].' }] },
    },
  },
  {
    id: '04-inline-choice',
    label: 'Part 2',
    type: 'inline-choice',
    config: {
      type: 'inline-choice',
      title: 'Part 2',
      content: { instructions: 'Listen first, then pick.', items: [{ text: 'a [*b|c]' }] },
    },
    media: { audio: { src: 'audio/lo-00-example/placeholder.m4a', label: 'Listen' } },
  },
];

function render(): string {
  return renderToStaticMarkup(
    <ExerciseSetBody label="Placeholder exercise set" instructions="Do both parts." tabs={TABS} />,
  );
}

test('one box above the tabs, then a tab row named by the set (S2)', () => {
  const html = render();

  expect(html.indexOf('Do both parts.')).toBeGreaterThan(-1);
  expect(html.indexOf('Do both parts.')).toBeLessThan(html.indexOf('role="tablist"'));
  expect(html).toContain('aria-label="Placeholder exercise set"');
  expect(html).toContain('>Part 1<');
  expect(html).toContain('>Part 2<');
});

test('a tab shows a box only when its exercise wrote one (S3)', () => {
  const html = render();

  expect(html).toContain('Listen first, then pick.');
  expect(html).not.toContain(EXERCISE_INSTRUCTIONS['drag-fill-gaps'].slice(0, 30));
});

test("a tab's media comes before its exercise (S5)", () => {
  const html = render();

  expect(html.indexOf('<audio')).toBeGreaterThan(-1);
  expect(html.indexOf('<audio')).toBeLessThan(html.indexOf('Listen first, then pick.'));
});

test('every panel prerenders the honest no-JavaScript line', () => {
  expect(render().split('needs JavaScript').length - 1).toBe(2);
});
```

- [ ] **Step 2:** `bun run test src/lo/ExerciseSet` — FAIL: module not found.

- [ ] **Step 3: Implement** `src/lo/ExerciseSet.tsx`:

```tsx
/**
 * ExerciseSet — the body of an exercise set (E57): one instruction box, then tabs that
 * each hold one exercise, with the tab's media above it.
 *
 * View-level on purpose: it takes ready-to-render tabs, not assembled LO data, so the
 * lesson page (`lo-page-sections.tsx`, inside `LoAccordion`) and the exercise showcase
 * (inside its card) render a set through exactly this path.
 *
 * ONE BOX, ABOVE THE TABS (maintainer, 2026-11-11, spec S2): its text arrives resolved
 * (`resolveSetInstructions`). A TAB HAS NO BOX "unless the tab has its own" (S3): each
 * exercise renders with `defaultInstructions={false}`, so only an `instructions` its
 * exercise.json wrote shows. Controls and score stay per tab (S4): each engine owns them.
 *
 * The tab UI is `TabSet`, whose panels stay mounted, so a learner's answers survive a
 * switch to another tab and back.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5.
 */
import { TabSet } from '@/components/shell/TabSet';
import type { ExerciseType } from '@/config/exercise-types';
import { ExerciseHost } from '@/exercises/lib/ExerciseHost';
import { ExerciseInstructions } from '@/exercises/lib/ExerciseInstructions';
import { MediaPanel } from './blocks/MediaPanel';
import type { Media } from './blocks/media-schema';

/** One tab as the set renders it. */
export interface ExerciseSetTabView {
  /** Stable key: the exercise's folder ref, or a showcase fixture id. */
  readonly id: string;
  /** The tab's label: its exercise's title. */
  readonly label: string;
  readonly type: ExerciseType;
  /** The validated exercise config, passed to the engine as-is. */
  readonly config: unknown;
  /** Where the exercise saves progress; the standalone key, `<lesson>/<ref>`. */
  readonly progressId?: string;
  /** Optional image and/or audio above the exercise. */
  readonly media?: Media;
}

interface ExerciseSetBodyProps {
  /** The tab row's accessible name: the set's title. */
  label: string;
  /** The box above the tabs, already resolved. */
  instructions: string;
  tabs: readonly ExerciseSetTabView[];
}

export function ExerciseSetBody({ label, instructions, tabs }: ExerciseSetBodyProps) {
  return (
    <div className="space-y-4">
      <ExerciseInstructions text={instructions} />
      <TabSet
        label={label}
        tabs={tabs.map((tab) => ({
          key: tab.id,
          label: tab.label,
          panel: (
            <>
              {tab.media === undefined ? null : <MediaPanel media={tab.media} className="mb-4" />}
              <ExerciseHost
                type={tab.type}
                config={tab.config}
                defaultInstructions={false}
                {...(tab.progressId === undefined ? {} : { progressId: tab.progressId })}
              />
            </>
          ),
        }))}
      />
    </div>
  );
}
```

If `ExerciseInstructions` adds its own bottom margin, drop `space-y-4` rather than doubling the gap
(compare with a standalone exercise in the browser in Task 10).

- [ ] **Step 4:** `bun run test src/lo/ExerciseSet` — PASS.
- [ ] **Step 5: Commit** `feat: render an exercise set's instruction box and tabs (E57)`.

---

### Task 5: The set in lo.json, and an exercise used once per lesson (S1, S7)

**Files:** modify `src/config/lo-schema.ts`; test `src/config/lo-schema.test.ts`.

- [ ] **Step 1: Failing tests.** Append to `lo-schema.test.ts` (add `import { z } from 'zod';`
      at the top):

```ts
// --- Exercise sets (E57) -------------------------------------------------------

const SET = {
  title: 'Reconstruct the text',
  tabs: [{ exercise: '03-drag-fill-gaps' }, { exercise: '04-drag-fill-gaps' }],
};

/** A manifest with one section listing these exercise entries. */
function withExercises(...exercises: unknown[]) {
  return { title: 'T', sections: [{ id: 'exercises', label: 'Exercises', exercises }] };
}

/** The prettified error for an input that must fail. */
function errorOf(input: unknown): string {
  const result = LoManifestSchema.safeParse(input);
  if (result.success) throw new Error('expected the manifest to fail');
  return z.prettifyError(result.error);
}

test('lo-schema: a section lists an exercise set beside plain refs (S1)', () => {
  const parsed = LoManifestSchema.parse(withExercises('01-select', SET, '02-radio-quiz'));

  expect(parsed.sections[0]?.exercises).toEqual(['01-select', SET, '02-radio-quiz']);
});

test('lo-schema: a set takes optional instructions and tab media', () => {
  const set = {
    ...SET,
    instructions: 'Do both parts.',
    tabs: [
      SET.tabs[0],
      { exercise: '04-drag-fill-gaps', media: { audio: { src: 'audio/x.m4a' } } },
    ],
  };

  expect(LoManifestSchema.safeParse(withExercises(set)).success).toBe(true);
});

test('lo-schema: a set needs a title, two tabs and no stray keys', () => {
  expect(LoManifestSchema.safeParse(withExercises({ ...SET, title: '' })).success).toBe(false);
  expect(LoManifestSchema.safeParse(withExercises({ ...SET, tabs: [SET.tabs[0]] })).success).toBe(
    false,
  );
  expect(LoManifestSchema.safeParse(withExercises({ ...SET, instructions: '' })).success).toBe(
    false,
  );
  expect(errorOf(withExercises({ ...SET, tabz: [] }))).toContain('tabz');
});

test.each([
  [
    'twice in sections',
    [
      { id: 'a', label: 'A', exercises: ['01-select'] },
      { id: 'b', label: 'B', exercises: ['01-select'] },
    ],
  ],
  [
    'twice in tabs',
    [
      {
        id: 'a',
        label: 'A',
        exercises: [{ ...SET, tabs: [{ exercise: '01-select' }, { exercise: '01-select' }] }],
      },
    ],
  ],
  ['in a section and a tab', [{ id: 'a', label: 'A', exercises: ['03-drag-fill-gaps', SET] }]],
])('lo-schema: an exercise used %s fails (S7)', (_case, sections) => {
  expect(errorOf({ title: 'T', sections })).toMatch(/used twice/);
});
```

- [ ] **Step 2:** `bun run test src/config/lo-schema` — FAIL: an object in `exercises` is
      rejected; the used-twice cases parse.

- [ ] **Step 3: Implement** in `lo-schema.ts`. Import with a RELATIVE path (this file uses no
      `@/…` imports; keep it that way, AGENTS.md hard constraint 1):

```ts
import { SetTabMediaSchema } from '../lo/blocks/media-schema';
```

Above `LoSectionSchema`:

```ts
/**
 * An EXERCISE SET (E57): one accordion, one instruction box, then tabs that each hold one
 * exercise folder, listed in a section's `exercises` beside the plain refs so it keeps its
 * place among them (maintainer, 2026-11-11, spec S1).
 *
 * `title` is the accordion's <h3> and names the tab row; a tab's label is its exercise's
 * own `title`, checked for uniqueness by the loader, which reads the exercise files.
 * `instructions` is optional (S2): absent, the loader uses the one engine's default copy.
 * A tab's `media` may have audio without a transcript (S5). Strict throughout.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §3.
 */
export const ExerciseSetTabSchema = z.strictObject({
  /** An exercise folder ref, e.g. "03-drag-fill-gaps". */
  exercise: z.string().min(1),
  /** Optional image and/or audio shown above the exercise. */
  media: SetTabMediaSchema.optional(),
});

export const ExerciseSetSchema = z.strictObject({
  title: z.string().min(1),
  instructions: z.string().min(1).optional(),
  tabs: z.array(ExerciseSetTabSchema).min(2),
});
export type ExerciseSet = z.infer<typeof ExerciseSetSchema>;

/** One entry of a section's `exercises`: a folder ref, or a set of them in tabs. */
export const SectionExerciseSchema = z.union([z.string().min(1), ExerciseSetSchema]);
export type SectionExercise = z.infer<typeof SectionExerciseSchema>;
```

In `LoSectionSchema`, replace the `exercises` line and its comment:

```ts
    /** Ordered exercise refs and exercise sets, e.g. ["01-select", { "title": …, "tabs": … }]. */
    exercises: z.array(SectionExerciseSchema).default([]),
```

In `LoManifestSchema`'s `superRefine`, after the duplicate-section check:

```ts
// An exercise is used once per lesson (E57, S7): twice repeats its DOM ids and shares
// its saved progress. In a section or in one tab of a set, never both.
const usedExercises = new Set<string>();
manifest.sections.forEach((section, sectionIndex) => {
  section.exercises.forEach((entry, entryIndex) => {
    const at = ['sections', sectionIndex, 'exercises', entryIndex];
    const uses =
      typeof entry === 'string'
        ? [{ ref: entry, path: at }]
        : entry.tabs.map((tab, tabIndex) => ({
            ref: tab.exercise,
            path: [...at, 'tabs', tabIndex, 'exercise'],
          }));
    for (const { ref, path } of uses) {
      if (usedExercises.has(ref)) {
        ctx.addIssue({
          code: 'custom',
          message: `exercise "${ref}" is used twice in this lesson — use it once, in a section or in one tab of a set`,
          path,
        });
      }
      usedExercises.add(ref);
    }
  });
});
```

Update the file header's "Schemas" list with `ExerciseSetSchema → one exercise set inside a
section's exercises[] (E57)`, and `LoSectionSchema`'s comment paragraph about separate arrays
with one sentence: "An `exercises` entry may also be an exercise set, whose tabs name exercise
refs (E57)."

If the `tabz` test fails because Zod's union error does not name the key, replace
`SectionExerciseSchema` with this, which parses a non-string with the set schema alone so its own
issues surface:

```ts
export const SectionExerciseSchema = z
  .union([z.string(), z.looseObject({})])
  .transform((entry, ctx): string | ExerciseSet => {
    const result = (typeof entry === 'string' ? z.string().min(1) : ExerciseSetSchema).safeParse(
      entry,
    );
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
    }
    return z.NEVER;
  });
```

- [ ] **Step 4:** `bun run test src/config` — PASS.
- [ ] **Step 5: Commit** `feat: list an exercise set in a section, each exercise once (E57)`.

---

### Task 6: Guard b counts the exercises inside a set

**Files:** modify `src/guards/render-mirror.ts`; test `src/guards/render-mirror.test.ts`.

- [ ] **Step 1: Failing test.** In the `describe('referencedRefs — what the manifest names')`
      block add:

```ts
it('counts the exercises inside a set as referenced (E57)', () => {
  const manifest = {
    sections: [
      {
        id: 'a',
        exercises: [
          '01-select',
          {
            title: 'Set',
            tabs: [{ exercise: '03-drag-fill-gaps' }, { exercise: '04-inline-choice' }],
          },
          '02-radio-quiz',
        ],
      },
    ],
  };

  expect(referencedRefs(manifest).exercises).toEqual([
    '01-select',
    '03-drag-fill-gaps',
    '04-inline-choice',
    '02-radio-quiz',
  ]);
});

it('reads a malformed set defensively, never throwing', () => {
  const manifest = {
    sections: [{ exercises: [{ tabs: 'nope' }, { tabs: [{ exercise: 4 }, null] }, 7] }],
  };

  expect(referencedRefs(manifest).exercises).toEqual([]);
});
```

- [ ] **Step 2:** `bun run test src/guards/render-mirror` — FAIL: the set's refs are missing.

- [ ] **Step 3: Implement.** In `render-mirror.ts`, beside `stringsAt`:

```ts
/**
 * The exercise refs one section names: its plain refs, and each exercise set's tab refs
 * (E57). Read as defensively as `stringsAt`: a shape it does not know yields nothing.
 */
function exerciseRefsAt(section: unknown): string[] {
  if (section === null || typeof section !== 'object') return [];
  const entries = (section as Record<string, unknown>).exercises;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry): string[] => {
    if (typeof entry === 'string') return entry === '' ? [] : [entry];
    if (entry === null || typeof entry !== 'object') return [];
    const tabs = (entry as { tabs?: unknown }).tabs;
    if (!Array.isArray(tabs)) return [];
    return tabs.flatMap((tab): string[] => {
      if (tab === null || typeof tab !== 'object') return [];
      const ref = (tab as { exercise?: unknown }).exercise;
      return typeof ref === 'string' && ref !== '' ? [ref] : [];
    });
  });
}
```

and in `referencedRefs` use `exercises: sectionList.flatMap(exerciseRefsAt),`. In the header's
"THE RULE" paragraph, after "REFERENCED = the refs `lo.json` names.", add: "(for exercises, the
plain refs and the refs in each exercise set's tabs, E57)".

- [ ] **Step 4:** `bun run test src/guards` — PASS.
- [ ] **Step 5: Commit** `feat: count an exercise set's refs in guard b (E57)`.

---

### Task 7: Assemble the set and render it on the lesson page

**Files:** modify `src/lo/assemble-lo.ts`, `src/lo/lo-page-sections.tsx`; test
`src/lo/assemble-lo.test.ts`, `src/lo/lo-page-sections.test.tsx`.

- [ ] **Step 1: Failing tests.** Append to `assemble-lo.test.ts` (import `isExerciseSet` from
      `./assemble-lo` and `EXERCISE_INSTRUCTIONS` from `@/exercises/lib/instructions`):

```ts
// --- Exercise sets (E57) ---------------------------------------------------------

/** validTree's files plus three tab exercises, with `set` listed after 01-select. */
function treeWithSet(set: object): LoFileTree {
  const tree = validTree();
  return {
    ...tree,
    manifest: {
      title: 'Salutations',
      sections: [{ id: 'exercises', label: 'Exercises', exercises: ['01-select', set] }],
    },
    exercises: {
      ...tree.exercises,
      '03-select': { type: 'select', title: 'Part 1', content: { items: [{ text: 'a [*b|c]' }] } },
      '04-select': { type: 'select', title: 'Part 2', content: { items: [{ text: 'd [*e|f]' }] } },
      '05-inline-choice': {
        type: 'inline-choice',
        title: 'Part 3',
        content: { items: [{ text: 'g [*h|i]' }] },
      },
    },
  };
}

test('assembleLo: a set resolves its tabs in order, with their media (E57)', () => {
  const lo = assembleLo(
    'lo-01-salutations',
    treeWithSet({
      title: 'Parts',
      tabs: [
        { exercise: '03-select' },
        { exercise: '04-select', media: { audio: { src: 'audio/x.m4a' } } },
      ],
    }),
    exerciseConfigSchema,
  );
  const set = lo.sections[0]?.exercises[1];
  if (set === undefined || !isExerciseSet(set)) throw new Error('expected a set');

  expect(set.id).toBe('exercise-set-03-select');
  expect(set.title).toBe('Parts');
  expect(set.instructions).toBe(EXERCISE_INSTRUCTIONS.select);
  expect(set.tabs.map((tab) => [tab.ref, tab.config.title])).toEqual([
    ['03-select', 'Part 1'],
    ['04-select', 'Part 2'],
  ]);
  expect(set.tabs[1]?.media).toEqual({ audio: { src: 'audio/x.m4a' } });
});

test('assembleLo: a set of different engines must write its instructions (S2)', () => {
  const tabs = [{ exercise: '03-select' }, { exercise: '05-inline-choice' }];

  expect(() => assembleLo('lo-01-salutations', treeWithSet({ title: 'Mixed', tabs }))).toThrow(
    /lo-config\/lo-01-salutations\/lo\.json[\s\S]*"Mixed"[\s\S]*write its instructions/,
  );
  const lo = assembleLo(
    'lo-01-salutations',
    treeWithSet({ title: 'Mixed', instructions: 'Do all three.', tabs }),
  );
  const set = lo.sections[0]?.exercises[1];
  expect(set !== undefined && isExerciseSet(set) && set.instructions).toBe('Do all three.');
});

test('assembleLo: two tabs titled alike fail — the title is the tab label', () => {
  const tree = treeWithSet({
    title: 'Parts',
    tabs: [{ exercise: '03-select' }, { exercise: '04-select' }],
  });
  const exercises = {
    ...tree.exercises,
    '04-select': { ...(tree.exercises['04-select'] as object), title: 'Part 1' },
  };

  expect(() => assembleLo('lo-01-salutations', { ...tree, exercises })).toThrow(
    /two tabs titled "Part 1"/,
  );
});

test('assembleLo: a tab naming a missing exercise names the file', () => {
  expect(() =>
    assembleLo(
      'lo-01-salutations',
      treeWithSet({ title: 'Parts', tabs: [{ exercise: '03-select' }, { exercise: '09-select' }] }),
    ),
  ).toThrow(/lo-config\/lo-01-salutations\/exercises\/09-select\/exercise\.json is missing/);
});

test("assembleLo: a tab's exercise is checked against its engine's schema", () => {
  const tree = treeWithSet({
    title: 'Parts',
    tabs: [{ exercise: '03-select' }, { exercise: '04-select' }],
  });
  const exercises = {
    ...tree.exercises,
    '04-select': { type: 'select', title: 'Part 2', content: {} },
  };

  expect(() =>
    assembleLo('lo-01-salutations', { ...tree, exercises }, exerciseConfigSchema),
  ).toThrow(/exercises\/04-select\/exercise\.json is invalid/);
});
```

Append to `lo-page-sections.test.tsx` (import `assembleLo` from `./assemble-lo`,
`renderToStaticMarkup` from `react-dom/server` and `toPageSections` as that file already does):

```tsx
test('an exercise set renders as one accordion holding its tabs (E57)', () => {
  const lo = assembleLo('lo-01-x', {
    manifest: {
      title: 'X',
      sections: [
        {
          id: 'exercises',
          label: 'Exercises',
          exercises: [
            { title: 'Parts', tabs: [{ exercise: '03-select' }, { exercise: '04-select' }] },
          ],
        },
      ],
    },
    blocks: {},
    exercises: {
      '03-select': { type: 'select', title: 'Part 1', content: { items: [{ text: 'a [*b|c]' }] } },
      '04-select': { type: 'select', title: 'Part 2', content: { items: [{ text: 'd [*e|f]' }] } },
    },
  });
  const html = renderToStaticMarkup(<>{toPageSections(lo)[0]?.content}</>);

  expect(html).toContain('id="exercise-set-03-select-heading"');
  expect(html).toContain('>Parts<');
  expect(html).toContain('aria-label="Parts"');
  expect(html.split('role="tabpanel"').length - 1).toBe(2);
});
```

- [ ] **Step 2:** `bun run test src/lo` — FAIL: `isExerciseSet` missing; the set is not assembled.

- [ ] **Step 3: Implement** in `assemble-lo.ts`. Imports: add `type ExerciseSet` to the
      `@/config/lo-schema` import, `import { resolveSetInstructions } from '@/exercises/lib/instructions';`
      and `import type { Media } from './blocks/media-schema';`. Types, after `AssembledPart`:

```ts
/** One tab of an assembled exercise set: its exercise, and optional media above it. */
export interface AssembledSetTab extends AssembledPart<LoExerciseConfig> {
  readonly media?: Media;
}

/** An exercise set (E57): one accordion, one instruction box, tabs of exercises. */
export interface AssembledExerciseSet {
  readonly kind: 'set';
  /** The accordion id: `exercise-set-<first tab's ref>`, unique because a ref is used once. */
  readonly id: string;
  readonly title: string;
  /** The box above the tabs: the set's own text, or its one engine's default copy. */
  readonly instructions: string;
  readonly tabs: readonly AssembledSetTab[];
}

/** One entry of a section's exercises: a plain exercise, or a set of them in tabs. */
export type AssembledExerciseEntry = AssembledPart<LoExerciseConfig> | AssembledExerciseSet;

/** Whether an assembled exercise entry is a set. */
export function isExerciseSet(entry: AssembledExerciseEntry): entry is AssembledExerciseSet {
  return 'kind' in entry && entry.kind === 'set';
}
```

Change `AssembledSection.exercises` to `readonly exercises: readonly AssembledExerciseEntry[];`.
Inside `assembleLo`, replace the section `exercises` mapping with a shared loader and a set
assembler:

```ts
const manifestPath = loPath(slug, 'lo.json');

/** One exercise file, checked against the envelope and, if given, its engine's schema. */
const loadExercise = (ref: string): LoExerciseConfig => {
  const filePath = loPath(slug, `exercises/${ref}/exercise.json`);
  const raw = requireFile(tree.exercises, ref, filePath);
  const config = parseFile(LoExerciseConfigSchema, raw, filePath);
  // The envelope only says which engine; the engine's own schema checks the
  // content, here at load, so a bad exercise fails the build and not the learner.
  if (exerciseSchema) parseFile(exerciseSchema(config.type), raw, filePath);
  return config;
};

/** One exercise set: its tabs resolved, its labels unique, its box decided (E57). */
const assembleSet = (set: ExerciseSet): AssembledExerciseSet => {
  const tabs = set.tabs.map<AssembledSetTab>((tab) => ({
    ref: tab.exercise,
    config: loadExercise(tab.exercise),
    ...(tab.media === undefined ? {} : { media: tab.media }),
  }));
  const titles = new Set<string>();
  for (const { config } of tabs) {
    if (titles.has(config.title)) {
      throw new Error(
        `${manifestPath}: the exercise set "${set.title}" has two tabs titled "${config.title}" — a tab's label is its exercise's title, and learners tell tabs apart by it`,
      );
    }
    titles.add(config.title);
  }
  const types = tabs.map((tab) => tab.config.type);
  const instructions = resolveSetInstructions(set.instructions, types);
  if (instructions === null) {
    throw new Error(
      `${manifestPath}: the exercise set "${set.title}" mixes ${[...new Set(types)].join(' and ')} — write its instructions, since no one engine's default copy fits`,
    );
  }
  return {
    kind: 'set',
    // A ref is used once per lesson (S7), so the first tab's ref names the set uniquely.
    id: `exercise-set-${set.tabs[0]?.exercise ?? ''}`,
    title: set.title,
    instructions,
    tabs,
  };
};
```

(`manifestPath` replaces the inline `loPath(slug, 'lo.json')` in the manifest's `parseFile` call
too.) The section mapping's exercises become:

```ts
    exercises: section.exercises.map<AssembledExerciseEntry>((entry) =>
      typeof entry === 'string' ? { ref: entry, config: loadExercise(entry) } : assembleSet(entry),
    ),
```

Add to the header: "An `exercises` entry may be an exercise set (E57): its tabs load like any
exercise, and the set's refusals (two tabs titled alike, mixed engines without instructions)
live here because titles and types live in the exercise files."

In `lo-page-sections.tsx`, import `isExerciseSet` and `type AssembledExerciseSet` from
`./assemble-lo` and `ExerciseSetBody` from `./ExerciseSet`, add:

```tsx
/** An exercise set: one accordion, its box, then its tabs (E57). Each tab's exercise saves
 *  progress under the same key it would standalone, so moving it into a set keeps it. */
function exerciseSet(set: AssembledExerciseSet, slug: string): ReactNode {
  return (
    <LoAccordion key={set.id} id={set.id} title={set.title}>
      <ExerciseSetBody
        label={set.title}
        instructions={set.instructions}
        tabs={set.tabs.map((tab) => ({
          id: tab.ref,
          label: tab.config.title,
          type: tab.config.type,
          config: tab.config,
          progressId: `${slug}/${tab.ref}`,
          ...(tab.media === undefined ? {} : { media: tab.media }),
        }))}
      />
    </LoAccordion>
  );
}
```

and render entries with:

```tsx
{
  section.exercises.map((entry) =>
    isExerciseSet(entry) ? (
      exerciseSet(entry, slug)
    ) : (
      <LoAccordion
        key={`exercise-${entry.ref}`}
        id={`exercise-${entry.ref}`}
        title={entry.config.title}
      >
        {/* ExerciseHost renders the instruction box itself, so the accordion's own
                instructions slot stays empty here — one instruction box, not two. */}
        <ExerciseHost
          type={entry.config.type}
          config={entry.config}
          progressId={`${slug}/${entry.ref}`}
        />
      </LoAccordion>
    ),
  );
}
```

Update the header: "Per section, in declared order: one `LoAccordion` per block, then one per
exercise or exercise set (E57, rendered by `ExerciseSetBody`)."

- [ ] **Step 4:** `bun run test` — PASS, the whole suite (other tests that build an
      `AssembledSection` by hand may need nothing; `tsc` runs in `bun run build`, so run
      `bun run build` too and fix any type error it names).
- [ ] **Step 5: Commit** `feat: assemble an exercise set and render it on the lesson page (E57)`.

---

### Task 8: The example lesson shows a set (S8)

**Files:** modify `lo-config/lo-00-example/lo.json`; create
`lo-config/lo-00-example/exercises/03-drag-fill-gaps/exercise.json`,
`lo-config/lo-00-example/exercises/04-inline-choice/exercise.json`; modify
`src/guards/render-mirror.test.ts`, `e2e/support.ts`.

The maintainer asked for this (2026-11-11), so editing the example is allowed here.

- [ ] **Step 1: Failing test.** In `render-mirror.test.ts`, the `presentParts` case that reads
      the example from disk expects
      `['01-select', '02-radio-quiz', '03-drag-fill-gaps', '04-inline-choice']`. Add to
      `src/lo/load-lo.test.ts` (import `loadLo` from `./load-lo-disk` and `isExerciseSet` from
      `./assemble-lo` if that file does not already):

```ts
test('the example lesson shows an exercise set between its two exercises (E57)', () => {
  const lo = loadLo('lo-00-example');
  const exercises = lo.sections.find((section) => section.id === 'exercises')?.exercises ?? [];

  expect(exercises.map((entry) => (isExerciseSet(entry) ? entry.id : entry.ref))).toEqual([
    '01-select',
    'exercise-set-03-drag-fill-gaps',
    '02-radio-quiz',
  ]);
});
```

- [ ] **Step 2:** `bun run test src/guards/render-mirror src/lo/load-lo` — FAIL.

- [ ] **Step 3: Implement.** `exercises/03-drag-fill-gaps/exercise.json`:

```json
{
  "type": "drag-fill-gaps",
  "title": "Part 1",
  "content": {
    "items": [
      { "text": "Yo [soy] de Madrid y ella [vive] en París." },
      { "text": "Nosotros [tenemos] hambre y vosotros [tenéis] sed." }
    ],
    "footnote": "Demo hint line — drag each word to its gap."
  },
  "options": { "shuffle": true }
}
```

`exercises/04-inline-choice/exercise.json`:

```json
{
  "type": "inline-choice",
  "title": "Part 2",
  "content": {
    "instructions": "Play the placeholder clip, then pick the word that completes each line.",
    "items": [
      { "text": "Buenos [*días|noches], señora." },
      { "text": "¿Cómo [*está|estás] usted, señor García?" }
    ]
  }
}
```

In `lo.json`, the Exercises section's list becomes:

```json
      "exercises": [
        "01-select",
        {
          "title": "Placeholder exercise set",
          "instructions": "Two parts, one tab each. Complete a part, then select Check in that part; Reset and Show answers work in each part too.",
          "tabs": [
            { "exercise": "03-drag-fill-gaps" },
            {
              "exercise": "04-inline-choice",
              "media": {
                "audio": {
                  "src": "audio/lo-00-example/placeholder.m4a",
                  "label": "Listen to the placeholder dialogue"
                }
              }
            }
          ]
        },
        "02-radio-quiz"
      ]
```

Read `blocks/07-intro/block.json`: if its text counts or names the section's exercises, add the
set to it. In `e2e/support.ts`, add `set: '#exercise-set-03-drag-fill-gaps-heading',` to
`EXERCISE_HEADINGS`.

- [ ] **Step 4:** `bun run test`, then `bun run build && bun run test:e2e` — PASS. Existing
      browser tests that count the example's accordions or exercises (`pages.spec.ts`,
      `axe-open-states.spec.ts`, `exercise-flows.spec.ts`) may need the set added; update a
      count only where the set is the reason, and say which in the commit body.
- [ ] **Step 5: Commit** `feat: show an exercise set in the example lesson (E57)`.

---

### Task 9: Two set cards on the exercise showcase (S6, S8)

**Files:** create `src/showcase/exercise-sets.ts`, test `src/showcase/exercise-sets.test.ts`;
modify `src/showcase/Showcase.tsx`, `src/showcase/showcase-sections.ts`,
`src/showcase/Showcase.test.tsx`.

- [ ] **Step 1: Failing test** `src/showcase/exercise-sets.test.ts`:

```ts
/**
 * exercise-sets.test.ts — the showcase's two set cards (E57): one engine with its default
 * copy above the tabs, and every engine in a tab.
 */
import { expect, test } from 'vitest';
import { EXERCISE_TYPE_KEYS } from '@/config/exercise-types';
import { EXERCISE_INSTRUCTIONS } from '@/exercises/lib/instructions';
import { SHOWCASE_SETS } from './exercise-sets';

const byId = (id: string) => SHOWCASE_SETS.find((set) => set.id === id);

test('the one-engine set shows that engine default copy above two tabs', () => {
  const set = byId('exercise-set');

  expect(set?.tabs).toHaveLength(2);
  expect(set?.instructions).toBe(EXERCISE_INSTRUCTIONS.select);
});

test('the every-engine set has one tab per engine, in registry order', () => {
  expect(byId('exercise-set-every-engine')?.tabs.map((tab) => tab.type)).toEqual([
    ...EXERCISE_TYPE_KEYS,
  ]);
});
```

In `Showcase.test.tsx`, add a case that the rendered page holds `article#exercise-set` and
`article#exercise-set-every-engine` (follow how that file renders `Showcase` and finds cards), and
update any count of sections or cards it asserts by two.

- [ ] **Step 2:** `bun run test src/showcase` — FAIL: module not found.

- [ ] **Step 3: Implement** `src/showcase/exercise-sets.ts`:

```ts
/**
 * exercise-sets.ts — the exercise showcase's exercise-set cards (E57, spec §7).
 *
 * "Exercise set": two tabs of one engine and no instructions, so the engine's default copy
 * shows above the tabs (S2). "Every engine in a tab": one tab per engine, each its first
 * showcase fixture, which `e2e/debug/exercise-set-engines.spec.ts` opens one by one to
 * prove every engine works in a tab (S6). Progress keys get a `set/` segment, so a deck in
 * a tab never shares saved progress with its own card above.
 */
import { EXERCISE_TYPE_KEYS } from '@/config/exercise-types';
import { resolveSetInstructions } from '@/exercises/lib/instructions';
import { selectFixtures } from '@/exercises/select/select.fixture';
import type { ExerciseSetTabView } from '@/lo/ExerciseSet';
import type { ShowcaseFixture } from './fixture-types';
import { SHOWCASE_FIXTURES } from './fixtures';

/** One set card: an anchor id, a title, its box and its tabs. */
export interface ShowcaseSet {
  readonly id: string;
  readonly title: string;
  readonly instructions: string;
  readonly tabs: readonly ExerciseSetTabView[];
}

function tabOf(fixture: ShowcaseFixture, label: string): ExerciseSetTabView {
  return {
    id: fixture.id,
    label,
    type: fixture.type,
    config: fixture.config,
    progressId: `showcase/set/${fixture.id}`,
  };
}

const oneEngine = selectFixtures
  .slice(0, 2)
  .map((fixture, index) => tabOf(fixture, `Part ${index + 1}`));
const oneEngineCopy = resolveSetInstructions(
  undefined,
  oneEngine.map((tab) => tab.type),
);
if (oneEngineCopy === null) throw new Error('the one-engine showcase set mixes engines');

const everyEngine = EXERCISE_TYPE_KEYS.map((type) => {
  const fixture = SHOWCASE_FIXTURES.find((candidate) => candidate.type === type);
  if (fixture === undefined) throw new Error(`no showcase fixture for ${type}`);
  return tabOf(fixture, type);
});

export const SHOWCASE_SETS: readonly ShowcaseSet[] = [
  {
    id: 'exercise-set',
    title: 'Exercise set — two tabs of one engine',
    instructions: oneEngineCopy,
    tabs: oneEngine,
  },
  {
    id: 'exercise-set-every-engine',
    title: 'Exercise set — every engine in a tab',
    instructions:
      'One tab per engine, each its first showcase fixture. Each tab keeps its own Check, Reset and Show answers.',
    tabs: everyEngine,
  },
];
```

In `Showcase.tsx` (import `ExerciseSetBody` from `@/lo/ExerciseSet` and `SHOWCASE_SETS` from
`./exercise-sets`), after the engines' `<section>`:

```tsx
<section aria-label="Exercise sets" className="mt-10 flex flex-col gap-10">
  {SHOWCASE_SETS.map((set) => (
    <article key={set.id} id={set.id} className="scroll-mt-6 rounded-lg border p-6">
      <h2 className="mb-4 text-xl font-semibold">{set.title}</h2>
      <ExerciseSetBody label={set.title} instructions={set.instructions} tabs={set.tabs} />
    </article>
  ))}
</section>
```

In `showcase-sections.ts`, append `...SHOWCASE_SETS.map((set) => ({ id: set.id, label: set.title })),`.
Add a sentence to `Showcase.tsx`'s header: "After the engines, two exercise-set cards (E57)."

- [ ] **Step 4:** `bun run test src/showcase` — PASS.
- [ ] **Step 5: Commit** `feat: show exercise sets on the exercise showcase (E57)`.

---

### Task 10: Browser tests

**Files:** create `e2e/exercise-set.spec.ts`, `e2e/debug/exercise-set-engines.spec.ts`.

- [ ] **Step 1:** Read `src/exercises/inline-choice/InlineChoiceExercise.tsx` (how a pill is
      exposed: a `radio` role is expected, as `exampleReady` waits on radiogroups) and
      `src/exercises/line-match/LineMatchExercise.tsx` (how a match is made and what draws its
      line), and copy the opening lines of `e2e/debug/flashcards-done.spec.ts` for a debug spec.

- [ ] **Step 2: Write** `e2e/exercise-set.spec.ts`:

```ts
/**
 * exercise-set.spec.ts — the example lesson's exercise set (E57): tabs labelled by
 * their exercises, Part 2's own box and audio, answers that survive a tab switch, the
 * dropdown below 48rem, and no axe violations with the set open.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5, §7.
 */
import { expect, test } from '@playwright/test';
import {
  EXERCISE_HEADINGS,
  exampleReady,
  expectNoAxeViolations,
  openExercise,
  watchForProblems,
} from './support';

const SET_NAME = 'Placeholder exercise set';

test.beforeEach(async ({ page }) => {
  await page.goto('example.html');
  await exampleReady(page);
});

test('the tabs are the exercises, and Part 2 has its own box and audio', async ({ page }) => {
  const problems = watchForProblems(page);
  const set = await openExercise(page, EXERCISE_HEADINGS.set);
  const row = set.getByRole('tablist', { name: SET_NAME });

  await expect(row.getByRole('tab')).toHaveText(['Part 1', 'Part 2']);
  await expect(set.getByRole('tabpanel', { name: 'Part 1' }).getByRole('note')).toHaveCount(0);
  await row.getByRole('tab', { name: 'Part 2' }).click();
  const part2 = set.getByRole('tabpanel', { name: 'Part 2' });
  await expect(part2.locator('audio')).toBeAttached();
  await expect(part2.getByText('Play the placeholder clip')).toBeVisible();
  expect(problems).toEqual([]);
});

test('an answer survives a switch to the other tab and back', async ({ page }) => {
  const set = await openExercise(page, EXERCISE_HEADINGS.set);
  const row = set.getByRole('tablist', { name: SET_NAME });
  await row.getByRole('tab', { name: 'Part 2' }).click();
  const pick = set.getByRole('tabpanel', { name: 'Part 2' }).getByRole('radio', { name: 'días' });

  await pick.click();
  await expect(pick).toBeChecked();
  await row.getByRole('tab', { name: 'Part 1' }).click();
  await row.getByRole('tab', { name: 'Part 2' }).click();
  await expect(pick).toBeChecked();
});

test('below 48rem a dropdown stands in for the tab row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const set = await openExercise(page, EXERCISE_HEADINGS.set);

  await expect(set.getByRole('tablist', { name: SET_NAME })).toBeHidden();
  await set.getByRole('combobox', { name: SET_NAME }).click();
  await page.getByRole('option', { name: 'Part 2' }).click();
  await expect(set.getByRole('tabpanel', { name: 'Part 2' })).toBeVisible();
});

test('no axe violations with the set open', async ({ page }) => {
  await openExercise(page, EXERCISE_HEADINGS.set);
  await expectNoAxeViolations(page);
});
```

and `e2e/debug/exercise-set-engines.spec.ts` (setup lines as in `flashcards-done.spec.ts`):

```ts
/**
 * exercise-set-engines.spec.ts — every engine works in a tab of an exercise set (E57,
 * spec S6). A hidden tab panel has no size, so an engine that measures its layout must
 * measure again when its tab shows; line-match and inline-gap do, through ResizeObserver.
 */
import { expect, test } from '@playwright/test';
import { card, openShowcase } from './debug-support';

test('every engine renders, sized and without error, when its tab opens', async ({ page }) => {
  await openShowcase(page);
  const set = card(page, 'exercise-set-every-engine');
  const tabs = set.getByRole('tab');
  await expect(tabs).toHaveCount(15);

  for (const tab of await tabs.all()) {
    const name = (await tab.textContent()) ?? '';
    await tab.click();
    const panel = set.getByRole('tabpanel', { name });
    await expect(panel, name).toBeVisible();
    await expect(panel.getByText('Loading…', { exact: true }), name).toHaveCount(0);
    await expect(panel.getByRole('alert'), name).toHaveCount(0);
    const box = await panel.boundingBox();
    expect(box?.height ?? 0, `${name} has a height`).toBeGreaterThan(100);
  }
});

test('line-match measures its stage once its tab shows', async ({ page }) => {
  await openShowcase(page);
  const set = card(page, 'exercise-set-every-engine');
  await set.getByRole('tab', { name: 'line-match' }).click();
  const panel = set.getByRole('tabpanel', { name: 'line-match' });

  // Make one match the way LineMatchExercise expects (Step 1), then check the line it
  // draws spans a non-zero width: drawn from a 0×0 measurement it would sit at 0,0.
});
```

Complete the line-match test from what Step 1 found: make one match, then assert the drawn line's
bounding box has a width above 10 pixels and lies inside `panel`'s box. If `inline-gap`'s
hang-under has a visible effect in its fixture, add the same kind of check for it; if not, say so
in the spec's deviations.

- [ ] **Step 3:** `bun run build && bun run test:e2e`, then
      `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e` — PASS in all three browsers. An engine
      that fails in a tab: fix it in its engine (its own test first) or, if the fix is out of
      reach, refuse that engine in a set tab in `assembleLo` and name it in the spec (S6).
- [ ] **Step 4: Commit** `test: browser checks for exercise sets (E57)`.

---

### Task 11: Docs

**Files:** `CONTRIBUTING.md`, `public/llms.txt`, `STRUCTURE.md`, `COURSE_GUIDE.md` (only if it
describes `lo.json`'s exercises), both tabs specs, the E57 spec, `docs/process/TODO.md`.
Re-read each doc immediately before editing it (Prettier reflows tables).

- [ ] **CONTRIBUTING.md**: after "### Tabs block", a section "### Exercise sets: exercises in
      tabs" with the `lo.json` sample from spec §3 and these bullets: `title` names the accordion
      and the tabs; at least two tabs; a tab's label is its exercise's `title` (unique in the
      set); `instructions` once above the tabs, optional only when every tab uses one engine; a
      tab shows a box only when its exercise.json writes `instructions`; each tab keeps its own
      Check, Reset and Show answers; `media` as the tabs block's, transcript optional; each
      exercise once per lesson; any engine works in a tab; `lo-00-example` has one. Link the
      spec. In "### Tabs block", replace "what is coming next (callouts and exercises in a tab)"
      with "what is coming next (callouts in a tab; exercises go in an exercise set, below)".
- [ ] **public/llms.txt**: where it describes a section's `exercises`, add that an entry may be an
      exercise set (title, optional instructions, tabs of `{ exercise, media? }`).
- [ ] **STRUCTURE.md**: add `src/components/shell/TabSet.tsx`, `src/lo/ExerciseSet.tsx`,
      `src/showcase/exercise-sets.ts`; if it embeds a generated tree, run `bun run docs:tree`.
- [ ] **COURSE_GUIDE.md**: if it lists what `lo.json` holds, link to the new CONTRIBUTING section;
      do not restate it.
- [ ] **Specs**: in `2026-10-07-tabs-block-design.md` §2, amend the "Panel entries beyond text" row's
      note: "exercise by folder ref: built instead as the exercise set, E57,
      with a link to the E57 spec". In the E57
      spec set **Status:** built, and add a "Deviations from this spec" note listing anything that
      changed while building (as the E56 spec does), including where the tab-switch state test
      lives (the browser, `e2e/exercise-set.spec.ts`, not Vitest: lazy engines do not hydrate in
      a static render).
- [ ] **TODO.md**: (a) the E56 entry: "(branch `feat/e56-footer-credits`; …" becomes "(PR 98, merged
      as `bf016ac`; …"; (b) a new E57 entry after E56 in the same style (spec, plan, what it does,
      the maintainer's decisions in one sentence each, **Verify:** the gate and the debug suite
      naming both new specs, **Next:** the Russian course uses it for lessons 6 and 7 with its next
      update); (c) "Done recently" rows for E56 (`bf016ac`, PR 98) and E57 (filled in once
      merged, see Task 12); (d) the "Last updated" line's suite counts from the final gate run.
- [ ] Run `bun run format && bun run test` (md-links checks every link).
- [ ] **Commit** `docs: record exercise sets (E57) and E56's pull request`.

---

### Task 12: Gate, review, pull request, merge

- [ ] Run the full gate:
      `bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e`,
      then `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e`, then from a folder and a fixed base
      (AGENTS.md hard constraint 3): `bun run build && SERVE_PATH=/any/folder/ bun run test:e2e`
      and `BASE_URL=/course/ bun run build && BASE_URL=/course/ bun run test:e2e`.
- [ ] Bundle budget: compare gzipped `main-*.js` and `main-*.css` with `docs/TOOLING.md`, "Bundle
      budget"; stop and report before raising a cap.
- [ ] Look at the set in the built site at 320, 768, 1024 and 1440 wide, both themes, keyboard
      only (Tab to the tab row, ←/→, into the exercise), and note it in the PR.
- [ ] Use the `before-pr` skill, and the `lc-reviewer` agent on the diff; fix CRITICAL and HIGH.
- [ ] Push `feat/e57-tab-exercises` with `-u`, open the PR (summary, the decisions S1–S8, test plan),
      add its number to the E57 TODO entry in one more commit, push.
- [ ] When CI is green, merge with **Rebase and merge** (`gh pr merge <N> --rebase`); never push
      to `main`. The merged commit is recorded in TODO by the next docs change, as E56's is here.
