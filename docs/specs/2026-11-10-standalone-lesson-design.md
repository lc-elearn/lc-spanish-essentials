# A course of one lesson — no landing page (E55)

**Date:** 2026-11-10 · **Status:** built 2026-11-11 (TODO §E55) · **Plan:** [`2026-11-10-standalone-lesson-plan.md`](../process/2026-11-10-standalone-lesson-plan.md)
**TODO:** §E55

> **Deviations from this spec.** (1) §5: the dev server reads `home` through
> `parseCourseHome()` (`src/config/course-home.ts`, via `readCourseHome()` in
> `src/config/course-json-disk.ts`), not `parseCourseConfig()`: one schema for `home`,
> and the dev plugin need not import `course.config.ts`. Same message prefix
> ("course.json is invalid"). (2) §8: the browser tests read the course's own
> `course.json` instead of a test-only build switch; `e2e/home-page.spec.ts` runs the
> half for the course's setting (the template, on "landing", runs the landing half in
> CI; the lesson half was run locally). The rail check uses
> `nav[aria-label="Lessons"]`, not a role query, since the collapsed rail's nav is not
> in the accessibility tree.

## 1. Why

Every build writes `dist/index.html` as the course landing page (`CourseHome`): hero
copy, the lesson rail and one card per lesson. Each lesson is its own page,
`dist/<slug>.html`.

Some Learning Objects stand alone: the course is one lesson. A student who opens it
lands on a page with one card, then clicks through to the lesson. The extra step does
nothing for them.

This is not the "sparse landing page with one lesson" item that §D6 closed on
2026-10-06. That decision kept the landing page's look for courses that will grow. This
spec is about courses that do not want a landing page at all.

A course that starts with one lesson can still gain more later. That switch has to be
one setting, checked by the build, and it must not break any link a student has saved
(§7).

## 2. Decisions (proposed; the maintainer confirms before the plan)

- **A setting in `course.json`, `home`**: `"landing"` (the default, today's
  behaviour) or `"lesson"`. It is optional, with a default, so no course has to edit
  its `course.json` to take the update (the rule in `course.config.ts`).

  ```json
  { "courseTitle": "…", "home": "lesson", "…": "…" }
  ```

- **`"lesson"` needs exactly one lesson**, counted as the landing page counts them:
  the example lesson is left out once the course has a lesson of its own
  (`buildLoIndex`). Any other count stops the build and the dev page, with a message
  that says what to change (§6).
- **In `"lesson"` mode, `index.html` is the lesson's page**: the same render as
  `<slug>.html`, with the lesson's title and description in `<head>`. No `CourseHome`,
  no rail, no cards.
- **`<slug>.html` is still written**, so the lesson has one address that never moves:
  before the switch to `"landing"` and after it (§7).
- **The header's course link is unchanged.** It still goes to `resolveHomeHref()`. On
  `index.html` that is the page itself; on `<slug>.html` it opens the same lesson at
  the front address. An earlier idea pointed it at `#content` on a standalone page.
  That is the second skip link that `Header.tsx` removed on purpose, so it is out.
- **`landingCopy` stays required**, even though `"lesson"` mode never shows it. It is
  ready when the course switches, and the schema needs no rule that depends on `home`.
- **Not chosen:**
  - **Switching automatically when there is one lesson.** The front address would
    change the moment a second folder appeared, a half-written lesson included, with
    nobody having decided it.
  - **`index.html` redirecting to `<slug>.html`** (meta refresh). Students would see a
    flash on every visit, and no-JS readers would get an extra hop. It also leaves a
    page that exists only to send them elsewhere.

## 3. Which lesson

The example-lesson filter now lives inside `buildLoIndex()` (`src/lo/lo-index.ts`). It
moves to its own pure function, so the landing page, the prerender and the dev server
count lessons one way:

```ts
/** The course's own lessons, in course order: the example left out once there is another. */
export function courseLessonFolders(folders: readonly string[]): string[];

/**
 * The one lesson a `home: "lesson"` course shows at its front address.
 * @throws Error saying how many lessons were found and what to change in course.json
 */
export function standaloneLessonFolder(folders: readonly string[]): string;
```

Both functions live in an alias-free module (relative imports only, like
`lo-slug.ts`), because the dev plugin reaches them from `vite.config.ts` (AGENTS.md,
hard constraint 1). `buildLoIndex()` calls `courseLessonFolders()` and does not change
its behaviour.

## 4. The build

`scripts/prerender.tsx`, when `courseConfig.home === 'lesson'`:

- It resolves `standaloneLessonFolder(loFolders)` before rendering anything, so a wrong
  count fails with nothing written (as the slug checks do now).
- It writes every lesson page as today, `example.html` included.
- It writes `index.html` with `renderLoPage(template, folder)` instead of
  `renderLandingPage`. The root div carries `data-lo-folder`, so `main.tsx` hydrates
  `App` with no change. It is still written last, because it replaces the template.
- The progress line reads `prerendered <folder> → dist/index.html (home: lesson)`.

`"landing"` mode is unchanged.

## 5. The dev server

`src/build/lo-dev-pages.ts`: in `"lesson"` mode, a GET for `/` or `/index.html` is
answered like a lesson page, with the standalone lesson's folder stamped on the dev
`index.html`. The setting is read from `course.json` **per request**, as the lesson
folders already are, so changing it needs a reload and not a restart. It is read
through `parseCourseConfig()` (`course.config.ts` is alias-free), so a bad value fails
the dev page with the build's message.

`devLoFolderForPath()` gains the case. Today `/` and `/index.html` always fall through
to Vite.

## 6. Messages

| Fault                                      | Message                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `home: "lesson"` with 2 or more lessons    | `course.json has "home": "lesson", but the course has N lessons (lo-01-…, lo-02-…). Set "home": "landing" to list them.` |
| `home` misspelt or another value           | Zod's own, through `parseCourseConfig()`: names `course.json` and `home`                                                 |
| `home: "lesson"` with no lesson of its own | Not a fault: the example lesson is the one lesson, as in the template itself                                             |

## 7. From one lesson to several

The teacher:

1. adds `lo-02-…`;
2. builds, which stops with the first message in §6;
3. sets `"home": "landing"` and builds again.

| Link or state                          | Before (`"lesson"`)    | After (`"landing"`)               |
| -------------------------------------- | ---------------------- | --------------------------------- |
| the front address (`index.html`)       | the lesson             | the landing page: one click to it |
| `<slug>.html`                          | the lesson             | the lesson: **unchanged**         |
| saved progress (flashcards, flip cues) | keyed by course folder | the same keys: **unchanged**      |

Progress keys are `storageScope()` plus each exercise's `progressId`
(`src/lib/assets.ts`), never a page address, so moving the lesson off `index.html`
loses nothing. The one visible change is the front address now opening the landing
page, which is what a course with several lessons wants. `COURSE_GUIDE.md` says so.

Going back, from `"landing"` to `"lesson"`, works the same way once only one lesson is
left.

## 8. Tests (written first)

- **The new module's tests:** `courseLessonFolders` (the example alone; the example
  plus one; several, in order). `standaloneLessonFolder` (one lesson; the example
  alone; two lessons throw a message naming both folders and `"landing"`).
- `lo-index.test.ts`: unchanged, and still passing. That shows the extraction kept the
  behaviour.
- `course.config.test.ts`: `home` defaults to `"landing"`, accepts `"lesson"` and
  refuses anything else, with the field named.
- `lo-dev-pages.test.ts`: in `"lesson"` mode, `/` and `/index.html` map to the lesson.
  In `"landing"` mode they fall through, as now.
- **The prerender** (`prerender-html.test.ts`, or a new test of whatever the script's
  `home` branch is extracted into): in `"lesson"` mode, `index.html` is stamped with
  the lesson's folder and carries the lesson's title. `<slug>.html` is still planned.
- **Browser (`e2e/`):** a build with `home: "lesson"` serves the lesson at
  `index.html`, with no lesson rail. The header's course link stays on the lesson. axe
  stays clean. This needs a course setting for one run, so the plan decides how: an
  environment override read only by the test build, or a fixture `course.json`.

## 9. Docs

- **`COURSE_GUIDE.md`:** the `course.json` row gains `home`, and a short "One lesson,
  or several" note gives §7's three steps and what changes for students.
- **`README.md`:** the paragraph on what the build writes says that `index.html` is
  the lesson's page in `"lesson"` mode.
- **`DEPLOY.md` step 6.3:** in `"lesson"` mode, `index.html` is the lesson.
- **`public/llms.txt`:** the Home line says what a one-lesson course shows there.
- **`docs/process/TODO.md`:** §E55, open until merged, then into "Done recently".

## 10. Not in this change

- **Draft lessons** (a folder that builds but is not listed). Today every folder is
  published, and that stays true.
- **A `<link rel="canonical">`** from `<slug>.html` to `index.html`. These courses are
  not searched for, and the two pages are the same course either way.
- **Any change to the landing page itself** (§D6 stands).

## 11. Rollout

1. A template pull request, through the full gate (AGENTS.md).
2. Each course takes it with its next template update. Nothing changes until a course
   sets `"home": "lesson"`.
3. A standalone course sets it in `course.json`, a green-path edit that merges once CI
   passes.
