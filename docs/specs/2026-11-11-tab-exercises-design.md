# Exercises in tabs: the exercise set (E57)

**Date:** 2026-11-11 · **Status:** built 2026-11-11 (TODO §E57) · **Plan:** [`2026-11-11-tab-exercises-plan.md`](../process/2026-11-11-tab-exercises-plan.md)
**TODO:** §E57 · **Builds on:** [`2026-10-07-tabs-block-design.md`](2026-10-07-tabs-block-design.md)
(the tab UI), [`2026-10-07-tabs-media-design.md`](2026-10-07-tabs-media-design.md) (media in a tab)

> **Deviations from this spec.** (1) §8: the answer-survives-a-switch test is in the
> browser (`e2e/exercise-set.spec.ts`), not Vitest: lazy engines render only after
> hydration, so a static render has no answer to keep. (2) §7: only `line-match` gets a
> measurement check. `inline-gap` places its feedback lines only after a Check, which
> needs its tab showing, so it never measures inside a hidden panel; the every-engine
> test covers it rendering. (3) S6: all 15 engines passed in a tab in Chromium, Firefox
> and WebKit with no change, so none is refused. (4) §3: a section's `exercises` entry is
> parsed with a transform, not a plain `z.union`, so a misspelt key in a set is named
> (a union reports only "Invalid input"). (5) §5: the set's body adds no gap below its
> box, which keeps the bottom margin it has above a standalone exercise. (6) The
> example's existing loader test (`load-lo.test.ts`) now lists the set, so it gained no
> second test. (7) Review: a set whose tabs are decks that save progress adds the
> saved-progress line to the default copy above the tabs, since its tabs show no box;
> and a set's `instructions` are trimmed, so a blank string fails.

## 1. Why

Two of the 2015 Russian lessons put exercises in tabs:

- **"6. Reconstruct the text"**: an accordion with one instruction box, then tabs
  "Part 1" and "Part 2", each a `drag-fill-gaps` exercise with its own word bank.
- **"7. Set expressions"**: instructions, then tabs "Dialogue 1" and "Dialogue 2", each
  an audio player followed by the dialogue's lines with a dropdown in each gap
  (`inline-choice` or `select`).

Both sit among the lesson's numbered exercises. A section renders all its blocks before
its exercises (`src/lo/lo-page-sections.tsx`), so a tabs **block** holding exercises could
never sit between exercise 5 and exercise 7. The tabs block's planned "exercise by folder
ref" entry (tabs-block spec §2) is therefore not what is built here; an **exercise set**
is. The Russian course is the first user.

## 2. Decisions (maintainer, 2026-11-11)

| #   | Decision                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | **A set lives in a section's `exercises` list**, as an object beside the plain refs, so it keeps its place among the exercises. Each tab's exercise stays an ordinary `exercises/NN-type/exercise.json` folder.                                                                                                    |
| S2  | **One instruction box, above the tabs.** The set's `instructions` are optional. Absent, the box shows the engine's default copy (it names Check, Reset and Show answers) when every tab uses one engine; a set whose tabs use different engines must write them. The box always shows.                             |
| S3  | **A tab shows no box of its own "unless the tab has its own"** (maintainer's words). A tab's exercise shows an instruction box only when its `exercise.json` writes `content.instructions`, for instance when the tabs hold different kinds of exercise. Otherwise no box: not the engine's default copy, nothing. |
| S4  | **Controls and score per tab.** Each tab's exercise keeps its own Check, Show answers, Reset and score, as a standalone exercise does. No set-wide button or score.                                                                                                                                                |
| S5  | **A tab may take `media`**, the tabs block's media (image, audio, transcript, the same `MediaPanel`), **with the transcript optional**: in "Set expressions" the exercise's own lines are the text, and Show answers fills the gaps. A transcript still needs audio.                                               |
| S6  | **Every engine may go in a tab, proven.** All 15 engines are allowed, and a browser test opens each one in a tab (§7). An engine that fails there is fixed in E57 or refused by the build, and named in this spec.                                                                                                 |
| S7  | **An exercise is used once per lesson**: once in a section list or in one tab, never twice and never both. This covers plain refs too, which already gave duplicate DOM ids and shared saved progress when listed twice.                                                                                           |
| S8  | **Shown in `lo-00-example` and on the exercise showcase** (§7).                                                                                                                                                                                                                                                    |

S2 and S3 do not change the tabs **block**: its rule that every tab has instructions
(maintainer, 2026-10-07) stands. A set is a different thing.

## 3. Config

In `lo.json`, a section's `exercises` array holds refs and set objects in page order:

```json
{
  "id": "exercises",
  "label": "Exercises",
  "exercises": [
    "01-select",
    {
      "title": "Reconstruct the text",
      "instructions": "Drag each word into its gap. Check, Reset and Show answers work per part.",
      "tabs": [
        { "exercise": "03-drag-fill-gaps" },
        {
          "exercise": "04-inline-choice",
          "media": { "audio": { "src": "audio/lo-07-x/dialogue-1.m4a", "label": "Dialogue 1" } }
        }
      ]
    },
    "02-radio-quiz"
  ]
}
```

- `title` — **required**. The accordion's `<h3>`, and the tab row's accessible name, so a
  set needs no separate `label` (a tabs block needs one because a plain block has no
  heading).
- `instructions` — optional, plain text, non-empty when given (S2).
- `tabs` — at least **two**. Each tab is `{ "exercise": "<ref>", "media"?: … }`.
- **A tab's label is its exercise's `title`**, which `exercise.json` already requires.
  Labels are unique within a set: they are what a learner tells tabs apart by.
- `media` — as the tabs block's (`src/lo/blocks/media-schema.ts`), except that `audio`
  may come without a `transcript` (S5).
- Strict objects throughout: a misspelt key fails the build.

Every path in `media` sits under `src`, which guard d already collects from every `.json`
under `lo-config/`, `lo.json` included; a missing file fails with no guard change.

## 4. What the build refuses

Each names `lo-config/<lesson>/lo.json` (or the exercise file) and the place:

| Mistake                                                            | Checked in                              |
| ------------------------------------------------------------------ | --------------------------------------- |
| a set with fewer than two tabs, a misspelt key, an empty title     | `LoSectionSchema` (`lo-schema.ts`)      |
| an exercise ref used twice in the lesson, in sections or tabs (S7) | `LoManifestSchema` (`lo-schema.ts`)     |
| a tab's ref with no `exercises/<ref>/exercise.json`                | `assembleLo`, as for any ref            |
| two tabs in one set whose exercises share a `title`                | `assembleLo` (titles live in the files) |
| no set `instructions` while the tabs use different engines (S2)    | `assembleLo` (types live in the files)  |
| `media` breaking a media rule (a transcript without audio, …)      | the set tab's media schema              |

A tab's exercise is checked against its engine's schema at load, as a section's is.

## 5. Rendering

- **The tab UI is shared.** The tab row, the dropdown below the `@3xl` container width
  and the kept-mounted panels move out of `TabsBlock.tsx` into one component that
  `TabsBlock` and the set both render. Nothing about the tabs block's look or markup
  changes.
- **A set renders** as `LoAccordion(title)`, then the set's instruction box (the
  `ExerciseInstructions` box exercises use, so the default copy's `**Check**` stays
  bold), then the tabs. Each panel: the tab's `media` if any, then the exercise through
  `ExerciseHost`.
- **`ExerciseHost` gains an option to skip the default copy**: in a tab it shows a box
  only when the exercise wrote `content.instructions` (S3). Everywhere else it behaves
  as today.
- **`MediaPanel` renders the player alone** when a set tab has audio and no transcript.
- **State survives a tab switch**: panels use `keepMounted`, so an answer stays when the
  learner switches away and back.
- **Saved progress** keeps the standalone key, `<lesson>/<ref>`, so moving an exercise
  into or out of a set keeps a flashcards deck's progress.
- **Ids.** The set's accordion is `exercise-set-<first tab's ref>`; a ref is used once per
  lesson (S7), so this cannot collide. Tab ids come from Base UI, as in the tabs block.
- **Prerender equals the first client render** (hard constraint 4): the tab UI is the
  tabs block's, and every panel's engine shows "This exercise needs JavaScript to run."
  until hydrated, as every exercise does.

## 6. Guard b

`referencedRefs` (`src/guards/render-mirror.ts`) reads only string entries of a section's
`exercises`, so a set's exercises would read as **unreferenced**. It also collects the
`tabs[].exercise` strings inside a set object. This widens what the guard sees; it
loosens nothing.

## 7. Where it is shown, and the engine proof

- **`lo-00-example`**: a set in the Exercises section between `01-select` and
  `02-radio-quiz`, titled "Placeholder exercise set", with its own `instructions` (its
  engines differ). Tab "Part 1" is a new `exercises/03-drag-fill-gaps/`, with no box of
  its own. Tab "Part 2" is a new `exercises/04-inline-choice/` with the placeholder audio
  (`audio/lo-00-example/placeholder.m4a`), no transcript, and an `instructions` of its
  own, so a copied lesson shows both tab cases.
- **Exercise showcase** (`DEBUG=1` builds only), two cards after the engines:
  - **"Exercise set"**: two tabs of one engine and no set `instructions`, so the default
    copy shows above the tabs.
  - **"Every engine in a tab"**: one tab per engine, each the engine's first showcase
    fixture. A browser test (`e2e/debug/`) opens every tab and checks the engine
    rendered with a non-zero size and no error. `line-match` and `inline-gap` measure
    their layout, and re-measure through `ResizeObserver` when a hidden panel shows; the
    test checks each measured correctly after its tab opened.

## 8. Tests (each written first, seen failing)

- `lo-schema.test.ts`: a set parses beside refs; fewer than two tabs, a misspelt key and
  an empty title fail; a ref used twice fails in each combination (two sections, two
  tabs, section and tab), naming the second use.
- Media schema: a set tab's media takes audio without a transcript; the tabs block's
  still refuses it; a transcript without audio fails in both.
- `assemble-lo.test.ts`: a set resolves its tabs in order with their configs; duplicate
  titles in a set fail; mixed engines without set instructions fail, the same engine
  without them passes.
- `render-mirror` test: refs inside a set count as referenced.
- `ExerciseHost`: with the default copy off, no box unless the exercise wrote one.
- `MediaPanel`: audio without a transcript renders the player and no toggle.
- The set component: the accordion `<h3>`, one box above the tabs (set text, or the
  default copy), the tab row named by the title, media before the exercise, a tab box
  only when written, and an answer surviving a switch to the other tab and back.
- `TabsBlock`'s existing tests pass unchanged after the extraction.
- Browser: `example.html` (tabs, the dropdown at narrow width, state across a switch,
  axe on the open set) and the showcase's every-engine card.

## 9. Docs

A "Exercise sets" section in `CONTRIBUTING.md` beside "Tabs block"; `public/llms.txt`
(the lesson format); `STRUCTURE.md` (the new files); `COURSE_GUIDE.md` only where it
describes `lo.json`, linking to CONTRIBUTING rather than restating it. `docs/process/TODO.md`
records E57.

## 10. Out of scope

| Not now                                     | Why                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| One Check / score for a whole set           | would need a check/reset/reveal/score API on all 15 engines (S4)          |
| An exercise in a tabs **block**'s tab       | a block cannot sit among exercises (§1); sets cover the reference lessons |
| A set inside a set, or tabs inside a tab    | depth 1, as the tabs block                                                |
| Engine-played item audio (`select` `audio`) | the player comes from the tab's `media`; engine audio is its own change   |
