# A course of one lesson (E55) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `course.json` setting, `home`, with the values `"landing"` (the default, today's behaviour) or `"lesson"`. With `"lesson"`, `dist/index.html` and the dev server's `/` are the course's one lesson, `<slug>.html` is still written, and the build and the dev page refuse `"lesson"` when the course has more than one lesson.

**Architecture:** Three small alias-free modules hold the rule, so the build, the dev server and the browser tests count lessons the same way. They are `src/config/course-home.ts` (the `home` schema), `src/config/course-json-disk.ts` (reads `home` from `course.json` under Node) and `src/lo/course-lessons.ts` (`courseLessonFolders`, `standaloneLessonFolder`, `frontPageLesson`). `scripts/prerender.tsx` writes the lesson's page to `index.html` when `frontPageLesson()` names a folder. `src/build/lo-dev-pages.ts` stamps that folder on `/` and `/index.html`. `main.tsx`, `App` and `Header` do not change: the root div's `data-lo-folder` already makes `main.tsx` render a lesson.

**Tech Stack:** TypeScript, Zod 4, Bun (prerender), Vite dev plugin, Vitest (`bun run test`, never `bun test`), Playwright + axe. Spec: [`docs/specs/2026-11-10-standalone-lesson-design.md`](../specs/2026-11-10-standalone-lesson-design.md).

**Ground rules (AGENTS.md):** `bun run test <path>`, never `bun test`. Tests sit beside the code as `<name>.test.ts` under `src/`; only `e2e/` is outside. Every task starts from a failing test. Vitest does not type-check, so run `bunx tsc -b` after each task that changes a type. One concern per commit, Conventional Commits. `main` is protected: work on a branch. Re-read a markdown doc immediately before editing it, and run `bun run format` before committing a doc. Do not weaken a guard. Nothing reachable from `vite.config.ts` may use an `@/…` import.

---

## Facts the code relies on (checked 2026-11-10)

- `main.tsx` renders `<App lo={loadLo(folder)}>` when `#root` has `data-lo-folder`, and
  `<CourseHome>` when it has none. `buildPrerenderedHtml({ template, appHtml, loFolder, title,
description })` (`src/build/prerender-html.ts`) stamps the folder; `injectRootDiv(html, {
loFolder })` is what the dev plugin uses for the same thing.
- `scripts/prerender.tsx` sorts the folders (`sortLoFolders(listLoSlugs())`), checks them
  with `loSlugsByFolder()`, renders every page in memory, checks collisions, writes the
  lesson pages, and writes `dist/index.html` **last**, because that file is the template.
  It may use `@/…` imports (it runs under Bun, not from `vite.config.ts`).
- `buildLoIndex(folders, loadLo)` (`src/lo/lo-index.ts`) leaves `lo-00-example` out once
  any other folder exists. `EXAMPLE_LO_FOLDER` is exported from there and imported by
  `src/sandbox/app-assets.ts`. `lo-index.ts` imports only `./lo-slug` and a type.
- `src/lo/lo-slug.ts` (`sortLoFolders`, `loSlugsByFolder`) and `src/lo/lo-folders.ts`
  (`listLoSlugs`, `node:fs`) are alias-free, and `vite.config.ts` reaches them through
  `src/build/lo-dev-pages.ts`.
- `course.config.ts` is a `z.strictObject`. A new key has to be optional with a default,
  so no course needs to edit its `course.json` (the file's own header says so).
  `course.json` today has no `home`.
- `devLoFolderForPath(pathname, loFolders)` in `lo-dev-pages.ts` returns `undefined` for
  `/` and `/index.html` after it validates the slugs. Its tests mock `../lo/lo-folders`
  with a `vi.hoisted` holder, and they drive the middleware through a fake server
  (`middleware(loadLo)` in `lo-dev-pages.test.ts`).
- `e2e/pages.spec.ts` checks `index.html` with `ready: async () => {}` and the lesson
  pages with `exampleReady` / `lessonReady` (`e2e/support.ts`). The landing page has
  `<h2>Lessons</h2>` and `<nav aria-label="Lessons">` (the rail). The header's course link
  is `a.site-header-brand`, with `href={resolveHomeHref()}`.

## Decisions this plan makes

- **`home` is read once per runtime.** The prerender reads `courseConfig.home`, which was
  validated at import. The dev server and the browser tests read `course.json` from disk
  through `readCourseHome()`, so a changed setting needs only a reload in dev. Both go
  through the one `CourseHomeSchema`.
- **The dev server reads `course.json` only for `/` and `/index.html`**, not on every
  asset request (`isFrontPagePath()`).
- **No test-only build switch.** The spec left this open (§8). An environment override
  would be a second source for `home`, so the browser tests read the course's own
  `course.json` instead. `e2e/home-page.spec.ts` runs its `"landing"` cases or its
  `"lesson"` cases, whichever the course has set. The template stays `"landing"`, so its
  CI runs the landing cases. Task 7 runs the lesson cases locally, by setting `"lesson"`
  and then reverting it. Any course that sets `"lesson"` runs them in its own CI.
- **The spec's `standaloneLessonFolder` stays**, and `frontPageLesson(folders, home)`
  wraps it. That way the prerender, the dev server and the tests make the same one-line
  decision.

## File structure

| File                                                                                             | Change | Responsibility                                                                          |
| ------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------- |
| `src/config/course-home.ts`                                                                      | create | `CourseHomeSchema`, `CourseHome`, `parseCourseHome()`                                   |
| `src/config/course-home.test.ts`                                                                 | create | the schema's rules and message                                                          |
| `src/config/course-json-disk.ts`                                                                 | create | `readCourseHome(file?)`: Node reader of `course.json`'s `home`                          |
| `src/config/course-json-disk.test.ts`                                                            | create | reads a temp file; a missing `home` is `"landing"`                                      |
| `src/config/course.config.ts`                                                                    | modify | add `home: CourseHomeSchema`                                                            |
| `src/config/course.config.test.ts`                                                               | modify | `home` defaults, accepts, refuses                                                       |
| `src/lo/course-lessons.ts`                                                                       | create | `EXAMPLE_LO_FOLDER`, `courseLessonFolders`, `standaloneLessonFolder`, `frontPageLesson` |
| `src/lo/course-lessons.test.ts`                                                                  | create | the counting rule and the message                                                       |
| `src/lo/lo-index.ts`                                                                             | modify | use `courseLessonFolders`; re-export `EXAMPLE_LO_FOLDER`                                |
| `src/build/lo-dev-pages.ts`                                                                      | modify | `isFrontPagePath`; `devLoFolderForPath(…, home)`; read `home` for `/`                   |
| `src/build/lo-dev-pages.test.ts`                                                                 | modify | lesson-mode `/` and `/index.html`; two-lesson error                                     |
| `scripts/prerender.tsx`                                                                          | modify | `index.html` from `renderLoPage` when `frontPageLesson()` names one                     |
| `e2e/pages.spec.ts`                                                                              | modify | `index.html` gets the lesson's readiness check in `"lesson"` mode                       |
| `e2e/home-page.spec.ts`                                                                          | create | what `index.html` is in each mode; the course link                                      |
| `COURSE_GUIDE.md`, `README.md`, `DEPLOY.md`, `public/llms.txt`, `docs/process/TODO.md`, the spec | modify | docs (Task 8)                                                                           |

---

### Task 0: Branch and commit the spec

**Files:** `docs/specs/2026-11-10-standalone-lesson-design.md`, `docs/process/2026-11-10-standalone-lesson-plan.md`, `docs/process/TODO.md` (all three exist, uncommitted on `main`)

- [ ] **Step 1: Branch**

```bash
git switch -c feat/standalone-lesson
```

- [ ] **Step 2: Commit the docs**

```bash
bun run format
git add docs/specs/2026-11-10-standalone-lesson-design.md docs/process/2026-11-10-standalone-lesson-plan.md docs/process/TODO.md
git commit -m "docs: spec and plan for a course of one lesson (E55)"
```

---

### Task 1: The `home` schema

**Files:**

- Create: `src/config/course-home.ts`
- Test: `src/config/course-home.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * course-home.test.ts — the `home` setting in course.json (TODO §E55): which page a
 * course opens on.
 */
import { describe, expect, it } from 'vitest';
import { CourseHomeSchema, parseCourseHome } from './course-home';

describe('CourseHomeSchema', () => {
  it('defaults to "landing", so a course.json without the key keeps its landing page', () => {
    expect(CourseHomeSchema.parse(undefined)).toBe('landing');
  });

  it('accepts "landing" and "lesson"', () => {
    expect(CourseHomeSchema.parse('landing')).toBe('landing');
    expect(CourseHomeSchema.parse('lesson')).toBe('lesson');
  });

  it('refuses any other value', () => {
    expect(CourseHomeSchema.safeParse('lessons').success).toBe(false);
  });
});

describe('parseCourseHome', () => {
  it('reads home from the whole course.json, ignoring the other keys', () => {
    expect(parseCourseHome({ courseTitle: 'X', home: 'lesson' })).toBe('lesson');
    expect(parseCourseHome({ courseTitle: 'X' })).toBe('landing');
  });

  it('names course.json and the field when the value is wrong', () => {
    expect(() => parseCourseHome({ home: 'single' })).toThrow(/course\.json is invalid[\s\S]*home/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/config/course-home.test.ts`
Expected: FAIL, `Failed to resolve import "./course-home"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * course-home.ts — the `home` setting in course.json (TODO §E55, spec
 * docs/specs/2026-11-10-standalone-lesson-design.md): `"landing"` opens the course on its
 * list of lessons; `"lesson"` opens it on its one lesson, with no landing page.
 *
 * Its own module, apart from course.config.ts, because three runtimes need the one rule:
 * the browser bundle (through course.config.ts), the Bun prerender, and the dev-server
 * plugin, which vite.config.ts imports. So it imports zod and nothing else (AGENTS.md
 * hard constraint 1), and it reads no file: `course-json-disk.ts` does that, for Node.
 */
import { z } from 'zod';

/** Optional, defaulting to today's behaviour, so no course has to edit its course.json. */
export const CourseHomeSchema = z.enum(['landing', 'lesson']).default('landing');

export type CourseHome = z.infer<typeof CourseHomeSchema>;

/** Only `home`; course.config.ts judges the other keys. */
const HomeOnlySchema = z.looseObject({ home: CourseHomeSchema });

/**
 * The `home` setting of a parsed course.json.
 * @throws Error naming course.json and the field, as parseCourseConfig() does
 */
export function parseCourseHome(raw: unknown): CourseHome {
  const result = HomeOnlySchema.safeParse(raw);
  if (!result.success) throw new Error(`course.json is invalid:\n${z.prettifyError(result.error)}`);
  return result.data.home;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `bun run test src/config/course-home.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/config/course-home.ts src/config/course-home.test.ts
git commit -m "feat: add the course home setting's schema"
```

---

### Task 2: `home` in `course.config.ts`

**Files:**

- Modify: `src/config/course.config.ts` (the schema object; add the field after `progressIcon`)
- Test: `src/config/course.config.test.ts`

- [ ] **Step 1: Write the failing test** (append to `course.config.test.ts`)

```ts
// TODO §E55: which page the course opens on. Optional, so a course.json without it keeps
// its landing page.
test('course.config schema: home defaults to "landing" and accepts "lesson"', () => {
  const { home: _home, ...base } = courseConfig;

  expect(CourseConfigSchema.parse(base).home).toBe('landing');
  expect(CourseConfigSchema.parse({ ...base, home: 'lesson' }).home).toBe('lesson');
});

test('course.config schema: refuses another home, naming the field', () => {
  const { home: _home, ...base } = courseConfig;

  expect(() => parseCourseConfig({ ...base, home: 'single' })).toThrow(/home/);
});
```

If ESLint flags `_home` as unused, use `const base = { ...courseConfig, home: undefined };`, as the `progressIcon` test does. `.default()` treats `undefined` as missing.

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/config/course.config.test.ts`
Expected: FAIL. `home` is `undefined` (strip) or refused as an unrecognized key.

- [ ] **Step 3: Add the field**

In `src/config/course.config.ts`, add `import { CourseHomeSchema } from './course-home';` under the `zod` import. Then add this field inside `CourseConfigSchema`, after `progressIcon`:

```ts
  /** Which page the course opens on (TODO §E55): its list of lessons, or its one lesson.
      `"lesson"` needs exactly one lesson; the build says so otherwise. */
  home: CourseHomeSchema,
```

Also extend the WHAT line of the header comment: `(title, language, deploy base path, landing copy, logo/favicon, home page)`.

- [ ] **Step 4: Run it to see it pass, then type-check**

Run: `bun run test src/config/` then `bunx tsc -b`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/config/course.config.ts src/config/course.config.test.ts
git commit -m "feat: add home to course.json's settings"
```

---

### Task 3: Reading `home` from disk

**Files:**

- Create: `src/config/course-json-disk.ts`
- Test: `src/config/course-json-disk.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * course-json-disk.test.ts — the Node reader of course.json's `home`, used by the dev
 * server and the browser tests (TODO §E55).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COURSE_JSON_PATH, readCourseHome } from './course-json-disk';

function courseJson(content: object): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'course-json-')), 'course.json');
  writeFileSync(file, JSON.stringify(content));
  return file;
}

describe('readCourseHome', () => {
  it('reads "lesson" from a course.json that sets it', () => {
    expect(readCourseHome(courseJson({ courseTitle: 'X', home: 'lesson' }))).toBe('lesson');
  });

  it('reads "landing" from a course.json without the key', () => {
    expect(readCourseHome(courseJson({ courseTitle: 'X' }))).toBe('landing');
  });

  it("points at the repo's own course.json by default", () => {
    expect(path.basename(COURSE_JSON_PATH)).toBe('course.json');
    expect(() => readCourseHome()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/config/course-json-disk.test.ts`
Expected: FAIL, `Failed to resolve import "./course-json-disk"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * course-json-disk.ts — course.json's `home` setting, read from disk under Node (TODO
 * §E55). The dev-server plugin reads it per request, as it reads the lesson folders, so a
 * changed setting needs a reload and not a restart. The browser tests read it to know
 * what index.html should be.
 *
 * Node only (`node:fs`), and alias-free: vite.config.ts reaches it through
 * lo-dev-pages.ts (AGENTS.md hard constraint 1). The browser bundle never imports it; it
 * has course.config.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCourseHome, type CourseHome } from './course-home';

/** The course's settings file, at the repo root. */
export const COURSE_JSON_PATH = path.resolve(import.meta.dirname, '../../course.json');

/** The course's `home`, read from `file` now. */
export function readCourseHome(file: string = COURSE_JSON_PATH): CourseHome {
  return parseCourseHome(JSON.parse(readFileSync(file, 'utf8')));
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `bun run test src/config/course-json-disk.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/config/course-json-disk.ts src/config/course-json-disk.test.ts
git commit -m "feat: read course.json's home setting under Node"
```

---

### Task 4: Which lesson is the front page

**Files:**

- Create: `src/lo/course-lessons.ts`
- Test: `src/lo/course-lessons.test.ts`
- Modify: `src/lo/lo-index.ts` (the `EXAMPLE_LO_FOLDER` constant and the filter in `buildLoIndex`)

- [ ] **Step 1: Write the failing test**

```ts
/**
 * course-lessons.test.ts — the course's own lessons, and the one a `home: "lesson"` course
 * opens on (TODO §E55).
 */
import { describe, expect, it } from 'vitest';
import {
  courseLessonFolders,
  EXAMPLE_LO_FOLDER,
  frontPageLesson,
  standaloneLessonFolder,
} from './course-lessons';

describe('courseLessonFolders', () => {
  it('is the example alone while it is the only lesson, as in the template', () => {
    expect(courseLessonFolders([EXAMPLE_LO_FOLDER])).toEqual([EXAMPLE_LO_FOLDER]);
  });

  it('leaves the example out once the course has a lesson of its own', () => {
    expect(courseLessonFolders([EXAMPLE_LO_FOLDER, 'lo-01-greetings'])).toEqual([
      'lo-01-greetings',
    ]);
  });

  it('keeps course order: the lo-NN- number, compared as a number', () => {
    expect(courseLessonFolders(['lo-10-later', EXAMPLE_LO_FOLDER, 'lo-9-earlier'])).toEqual([
      'lo-9-earlier',
      'lo-10-later',
    ]);
  });
});

describe('standaloneLessonFolder', () => {
  it("is the course's one lesson", () => {
    expect(standaloneLessonFolder([EXAMPLE_LO_FOLDER, 'lo-01-greetings'])).toBe('lo-01-greetings');
  });

  it('is the example in the template, where it is the only lesson', () => {
    expect(standaloneLessonFolder([EXAMPLE_LO_FOLDER])).toBe(EXAMPLE_LO_FOLDER);
  });

  it('refuses two lessons, naming them and the setting to change', () => {
    expect(() =>
      standaloneLessonFolder([EXAMPLE_LO_FOLDER, 'lo-01-greetings', 'lo-02-food']),
    ).toThrow(
      'course.json has "home": "lesson", but the course has 2 lessons (lo-01-greetings, lo-02-food). Set "home": "landing" to list them.',
    );
  });
});

describe('frontPageLesson', () => {
  const FOLDERS = [EXAMPLE_LO_FOLDER, 'lo-01-greetings', 'lo-02-food'];

  it('is no lesson for "landing": the front page is the list of lessons', () => {
    expect(frontPageLesson(FOLDERS, 'landing')).toBeUndefined();
  });

  it('is the one lesson for "lesson"', () => {
    expect(frontPageLesson([EXAMPLE_LO_FOLDER, 'lo-01-greetings'], 'lesson')).toBe(
      'lo-01-greetings',
    );
  });

  it('throws for "lesson" with more than one lesson', () => {
    expect(() => frontPageLesson(FOLDERS, 'lesson')).toThrow(/Set "home": "landing"/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/lo/course-lessons.test.ts`
Expected: FAIL, `Failed to resolve import "./course-lessons"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * course-lessons.ts — the course's own lessons, and which one a `home: "lesson"` course
 * opens on (TODO §E55, spec docs/specs/2026-11-10-standalone-lesson-design.md).
 *
 * One rule for counting lessons, used by the landing page (`buildLoIndex`), the prerender,
 * the dev server and the browser tests: the example lesson counts only while it is the
 * only one (lo-index.ts says why).
 *
 * Alias-free and pure: the dev-server plugin, which vite.config.ts imports, uses it
 * (AGENTS.md hard constraint 1).
 */
import type { CourseHome } from '../config/course-home';
import { sortLoFolders } from './lo-slug';

/** The example lesson's folder: the template's demo and every course's master copy. */
export const EXAMPLE_LO_FOLDER = 'lo-00-example';

/** The course's own lessons, in course order: the example left out once there is another. */
export function courseLessonFolders(folders: readonly string[]): readonly string[] {
  const sorted = sortLoFolders(folders);
  const hasOwnLesson = sorted.some((folder) => folder !== EXAMPLE_LO_FOLDER);
  return sorted.filter((folder) => !(hasOwnLesson && folder === EXAMPLE_LO_FOLDER));
}

/**
 * The one lesson a `home: "lesson"` course shows at its front address.
 * @throws Error saying how many lessons there are and what to change in course.json
 */
export function standaloneLessonFolder(folders: readonly string[]): string {
  const lessons = courseLessonFolders(folders);
  const [only] = lessons;
  if (lessons.length === 1 && only !== undefined) return only;
  throw new Error(
    `course.json has "home": "lesson", but the course has ${lessons.length} lessons (${lessons.join(', ')}). Set "home": "landing" to list them.`,
  );
}

/**
 * The lesson whose page is also index.html, or undefined when index.html is the landing
 * page.
 * @throws Error from standaloneLessonFolder() for "lesson" with more than one lesson
 */
export function frontPageLesson(folders: readonly string[], home: CourseHome): string | undefined {
  return home === 'lesson' ? standaloneLessonFolder(folders) : undefined;
}
```

- [ ] **Step 4: Point `buildLoIndex` at it**

In `src/lo/lo-index.ts`, replace

```ts
/** The example lesson's folder: the template's demo and every course's master copy. */
export const EXAMPLE_LO_FOLDER = 'lo-00-example';
```

with

```ts
import { courseLessonFolders } from './course-lessons';

/** Re-exported where it always lived; the rule that uses it is in course-lessons.ts. */
export { EXAMPLE_LO_FOLDER } from './course-lessons';
```

Move that `import` up with the other two imports. In `buildLoIndex`, replace

```ts
const hasOwnLesson = folders.some((folder) => folder !== EXAMPLE_LO_FOLDER);
const listed = [...slugsByFolder].filter(
  ([folder]) => !(hasOwnLesson && folder === EXAMPLE_LO_FOLDER),
);
```

with

```ts
const lessons = new Set(courseLessonFolders(folders));
const listed = [...slugsByFolder].filter(([folder]) => lessons.has(folder));
```

Keep `loSlugsByFolder(sortLoFolders(folders))` first: it is the check that throws on a bad folder name.

- [ ] **Step 5: Run both tests to see them pass, then type-check**

Run: `bun run test src/lo/` then `bunx tsc -b`
Expected: PASS. `lo-index.test.ts` is unchanged and still green, which shows the extraction kept the behaviour. No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lo/course-lessons.ts src/lo/course-lessons.test.ts src/lo/lo-index.ts
git commit -m "feat: name the lesson a one-lesson course opens on"
```

---

### Task 5: The dev server answers `/` with the lesson

**Files:**

- Modify: `src/build/lo-dev-pages.ts` (`devLoFolderForPath` and the middleware's `try`)
- Test: `src/build/lo-dev-pages.test.ts`

- [ ] **Step 1: Write the failing tests**

At the top of `lo-dev-pages.test.ts`, beside the `lo-folders` mock:

```ts
// The dev server reads course.json's home per front-page request; these tests set it.
const courseHome = vi.hoisted(() => ({ value: 'landing' as 'landing' | 'lesson' }));
vi.mock('../config/course-json-disk', () => ({ readCourseHome: () => courseHome.value }));
```

Inside `describe('devLoFolderForPath', …)`:

```ts
// TODO §E55: a `home: "lesson"` course has no landing page, so the front page is its
// lesson. "landing" keeps the root for Vite, as the test above says.
it('resolves the site root to the one lesson when home is "lesson"', () => {
  expect(devLoFolderForPath('/', FOLDERS, 'lesson')).toBe('lo-01-going-to-a-cafe');
  expect(devLoFolderForPath('/index.html', FOLDERS, 'lesson')).toBe('lo-01-going-to-a-cafe');
});

it('refuses home "lesson" on the site root when there are two lessons', () => {
  expect(() => devLoFolderForPath('/', [...FOLDERS, 'lo-02-food'], 'lesson')).toThrow(
    /Set "home": "landing"/,
  );
});

it('leaves lesson pages alone when home is "lesson"', () => {
  expect(devLoFolderForPath('/going-to-a-cafe.html', FOLDERS, 'lesson')).toBe(
    'lo-01-going-to-a-cafe',
  );
});
```

Inside `describe('loDevPages on the dev server', …)`, set `courseHome.value = 'landing';` in its `beforeEach` and add:

```ts
it('answers / with the lesson, stamped, when course.json says home "lesson"', async () => {
  diskFolders.list = ['lo-00-example', 'lo-01-greetings'];
  courseHome.value = 'lesson';
  const { request } = middleware(() => ({}));
  expect((await request('/')).body).toContain('lo-01-greetings');
});

it('leaves / to Vite when course.json says home "landing"', async () => {
  const { request, server } = middleware(() => ({}));
  expect(await request('/')).toEqual({ error: undefined });
  expect(server.ssrLoadModule).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun run test src/build/lo-dev-pages.test.ts`
Expected: FAIL. The new cases get `undefined` where a folder is expected, and the middleware case never sends a body.

- [ ] **Step 3: Implement**

In `src/build/lo-dev-pages.ts`, add these imports beside the existing relative ones:

```ts
import type { CourseHome } from '../config/course-home';
import { readCourseHome } from '../config/course-json-disk';
import { frontPageLesson } from '../lo/course-lessons';
```

Add this function above `devLoFolderForPath`:

```ts
/** The course's front address: `/`, or `/index.html` spelled out. */
export function isFrontPagePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/index.html';
}
```

Replace `devLoFolderForPath` with:

```ts
/**
 * Which LO folder, if any, renders the page at `pathname`.
 *
 * Base-relative: the caller strips the dev server's base first, so this sees `/x.html`
 * whether the course is served from `/` or `/course/`.
 *
 * @param pathname a request path with no query or hash
 * @param loFolders LO folder names under `lo-config/`
 * @param home course.json's `home`: with "lesson", the front page is the one lesson
 *   (TODO §E55); with "landing", it is Vite's own index.html
 * @returns the folder whose page this is, or undefined — undefined means "not ours",
 *   so the request falls through to the middleware that owns it (a real 404 included)
 * @throws Error naming the folder when an LO folder name is malformed, or its slug is
 *   taken by another folder or by one of the course's own pages; and for "lesson"
 *   with more than one lesson
 */
export function devLoFolderForPath(
  pathname: string,
  loFolders: readonly string[],
  home: CourseHome = 'landing',
): string | undefined {
  const match = LO_PAGE_PATH_PATTERN.exec(pathname);
  const isFrontPage = isFrontPagePath(pathname);
  if (!isFrontPage && match === null) return undefined;

  // The build's own check on the whole set, on every page request: a duplicate slug or
  // one of the course's own page names (`index`, a debug page) fails here, naming the
  // folder, instead of only when someone runs `bun run build`.
  const slugsByFolder = loSlugsByFolder(loFolders);
  if (isFrontPage) return frontPageLesson(loFolders, home);
  if (match === null) return undefined;

  const slug = match[1];
  return [...slugsByFolder].find(([, folderSlug]) => folderSlug === slug)?.[0];
}
```

In the middleware's `try`, replace

```ts
loFolder = devLoFolderForPath(basePath, listLoSlugs());
```

with

```ts
// course.json is read only for the front page, and per request, so a changed `home`
// needs a reload, not a restart.
const home = isFrontPagePath(basePath) ? readCourseHome() : 'landing';
loFolder = devLoFolderForPath(basePath, listLoSlugs(), home);
```

Add one paragraph to the file's header comment, after "THE FIX":

```
 * ONE-LESSON COURSES (TODO §E55). With `home: "lesson"` in course.json, `/` and
 * `/index.html` are that lesson's page too, as `dist/index.html` is in the build.
```

- [ ] **Step 4: Run them to see them pass, then type-check and check the config still loads**

Run: `bun run test src/build/lo-dev-pages.test.ts`, `bunx tsc -b`, then `bun run guards`
Expected: PASS. The guards include the alias rule for anything `vite.config.ts` reaches.

- [ ] **Step 5: Commit**

```bash
git add src/build/lo-dev-pages.ts src/build/lo-dev-pages.test.ts
git commit -m "feat: serve a one-lesson course's lesson at / in dev"
```

---

### Task 6: The build writes the lesson to `index.html`

**Files:** Modify `scripts/prerender.tsx`. No unit test: the script has none, and its one new decision is `frontPageLesson()`, which Task 4 tested. Task 7's browser tests check the output.

- [ ] **Step 1: Implement**

Add `import { frontPageLesson } from '@/lo/course-lessons';` to the imports. Right after the `if (slugsByFolder.size === 0) throw …` line, add:

```ts
// `home: "lesson"` (TODO §E55): the course's one lesson is also its front page. Asked
// before anything renders, so "lesson" with two lessons fails with nothing written.
const frontLesson = frontPageLesson(loFolders, courseConfig.home);
```

Replace

```ts
const landingHtml = renderLandingPage(template, loFolders);
```

with

```ts
// The lesson's own page above is still written: its address stays the same when the
// course later switches to "landing" (spec §7).
const frontHtml =
  frontLesson === undefined
    ? renderLandingPage(template, loFolders)
    : renderLoPage(template, frontLesson);
```

Replace the last two lines with:

```ts
writeFileSync(TEMPLATE_PATH, frontHtml, 'utf-8');
process.stdout.write(
  frontLesson === undefined
    ? `prerendered course landing page → dist/index.html\n`
    : `prerendered ${frontLesson} → dist/index.html (home: lesson)\n`,
);
```

In the header comment, add to the paragraph "Every folder under `lo-config/` gets one file…": `A course with \`home: "lesson"\` in course.json writes its one lesson to index.html as well (TODO §E55).`

- [ ] **Step 2: Build in both modes**

Run: `bun run build`
Expected: the last line is `prerendered course landing page → dist/index.html`.

Then, temporarily, add `"home": "lesson"` to `course.json` and run `bun run build`.
Expected: `prerendered lo-00-example → dist/example.html` and `prerendered lo-00-example → dist/index.html (home: lesson)`. `grep -c 'data-lo-folder="lo-00-example"' dist/index.html` prints `1`.

Keep `"home": "lesson"` in place for Task 7. Do not commit it.

- [ ] **Step 3: Commit the script only**

```bash
git add scripts/prerender.tsx
git commit -m "feat: write a one-lesson course's lesson to index.html"
```

---

### Task 7: Browser tests

**Files:**

- Create: `e2e/home-page.spec.ts`
- Modify: `e2e/pages.spec.ts` (the `PAGES` list)

- [ ] **Step 1: Write the spec**

```ts
/**
 * home-page.spec.ts — what index.html is (TODO §E55): the landing page, or, with
 * `home: "lesson"` in course.json, the course's one lesson. Reads the course's own
 * course.json, so a course runs the half that applies to it; the template, which keeps
 * "landing", runs the first half in CI. The second half is run by setting "lesson" and
 * building (docs/process/2026-11-10-standalone-lesson-plan.md, Task 7).
 */
import { expect, test } from '@playwright/test';

import { readCourseHome } from '../src/config/course-json-disk';
import { frontPageLesson } from '../src/lo/course-lessons';
import { listLoSlugs } from '../src/lo/lo-folders';
import { loSlugsByFolder, sortLoFolders } from '../src/lo/lo-slug';

const FOLDERS = sortLoFolders(listLoSlugs());
const FRONT_LESSON = frontPageLesson(FOLDERS, readCourseHome());

test.describe('home: "landing"', () => {
  test.skip(FRONT_LESSON !== undefined, 'this course opens on its lesson');

  test('index.html lists the lessons', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.getByRole('heading', { level: 2, name: 'Lessons' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Lessons' })).toBeAttached();
  });
});

test.describe('home: "lesson"', () => {
  test.skip(FRONT_LESSON === undefined, 'this course opens on its list of lessons');
  const folder = FRONT_LESSON ?? '';
  const slug = loSlugsByFolder(FOLDERS).get(folder) ?? '';

  test('index.html is the lesson, with no landing page', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.locator('#root')).toHaveAttribute('data-lo-folder', folder);
    await expect(page.getByRole('heading', { level: 2, name: 'Lessons' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Lessons' })).toHaveCount(0);
  });

  test("the lesson's own page is still built", async ({ page }) => {
    const response = await page.goto(`${slug}.html`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).toHaveAttribute('data-lo-folder', folder);
  });

  test('the course link in the header opens the same lesson', async ({ page }) => {
    await page.goto(`${slug}.html`);
    await page.locator('a.site-header-brand').click();
    await expect(page).toHaveURL(/\/(index\.html)?$/);
    await expect(page.locator('#root')).toHaveAttribute('data-lo-folder', folder);
  });
});
```

- [ ] **Step 2: Give `index.html` the right readiness check in `pages.spec.ts`**

Add these imports:

```ts
import { readCourseHome } from '../src/config/course-json-disk';
import { EXAMPLE_LO_FOLDER, frontPageLesson } from '../src/lo/course-lessons';
```

Replace

```ts
const PAGES: PageCase[] = [{ path: 'index.html', ready: async () => {} }, ...LESSON_PAGES];
```

with

```ts
/** index.html is the landing page, or, with `home: "lesson"`, the lesson (TODO §E55). */
function frontPageReady(): PageCase['ready'] {
  const lesson = frontPageLesson(sortLoFolders(listLoSlugs()), readCourseHome());
  if (lesson === undefined) return async () => {};
  return lesson === EXAMPLE_LO_FOLDER ? exampleReady : lessonReady;
}

const PAGES: PageCase[] = [{ path: 'index.html', ready: frontPageReady() }, ...LESSON_PAGES];
```

- [ ] **Step 3: Run the lesson half** (`course.json` still has `"home": "lesson"` from Task 6)

Run: `bun run build && bun run test:e2e e2e/home-page.spec.ts e2e/pages.spec.ts`
Expected: PASS. The 3 `home: "lesson"` cases pass in each browser, and the landing case is skipped. `pages.spec.ts` passes `index.html` with `exampleReady` and axe clean.

Task 6 is already committed, so show that the lesson half **can fail**: temporarily change `'data-lo-folder', folder` in the first lesson test to `'data-lo-folder', 'nope'`, run it, see it FAIL, then put it back.

- [ ] **Step 4: Revert `course.json` and run the landing half**

```bash
git checkout course.json
bun run build && bun run test:e2e e2e/home-page.spec.ts e2e/pages.spec.ts
```

Expected: PASS. The landing case passes, and the 3 lesson cases are skipped.

- [ ] **Step 5: Check the dev server in lesson mode**

Set `"home": "lesson"` in `course.json` again. Run the dev server with `preview_start` (the repo's `.claude/launch.json`) and open `/`.
Expected: the example lesson, with no rail. Then set `"home": "landing"`, or remove the key, and reload with no restart.
Expected: the landing page. Finish with `git checkout course.json`.

- [ ] **Step 6: Commit**

```bash
git status --short   # course.json must NOT be listed
git add e2e/home-page.spec.ts e2e/pages.spec.ts
git commit -m "test: check index.html in both home modes"
```

---

### Task 8: Docs

Re-read each file immediately before editing it (Prettier reflows tables).

**Files:** `COURSE_GUIDE.md`, `README.md`, `DEPLOY.md`, `public/llms.txt`, `docs/specs/2026-11-10-standalone-lesson-design.md`, `docs/process/TODO.md`

- [ ] **Step 1: `COURSE_GUIDE.md`, "What you may edit"**

In the `course.json` row, change "your course's title, language code, home-page heading and subheading, logo and icon names" to "your course's title, language code, home-page heading and subheading, logo and icon names, and whether it opens on its list of lessons or on its one lesson (`home`)".

After the paragraph that begins "`course.json` is checked when the site builds", add:

```markdown
### One lesson, or several

A course of one lesson can skip the list of lessons: `"home": "lesson"` in `course.json`
makes the course's front page the lesson itself. Without the key, or with
`"home": "landing"`, the front page lists the lessons.

When a second lesson arrives, the build stops and says so. Change the setting to
`"landing"` and build again. For students, the front address now opens the list of
lessons, one click from the lesson. A link straight to the lesson (`<slug>.html`) and
their saved progress are unchanged.
```

- [ ] **Step 2: `README.md`**, the paragraph that begins "The build emits **one real HTML file per folder**"

After the sentence ending "(CONTRIBUTING, "Authoring a Learning Object").", add: `A course of one lesson can set \`"home": "lesson"\` in \`course.json\`: \`dist/index.html\` is then that lesson's page, with no landing page (COURSE_GUIDE, "One lesson, or several").`

- [ ] **Step 3: `DEPLOY.md`**, step 6, check 3 ("No internal pages")

After the code block that runs `ls dist/*.html`, and before "If you see", add: `With \`"home": "lesson"\` in \`course.json\`, \`index.html\` is the lesson itself, and the lesson's own page is there too.`

- [ ] **Step 4: `public/llms.txt`**, the Home bullet (the one that links to the site's index page)

Append: `A course of one lesson may set \`home: "lesson"\` in its settings; its Home is then that lesson's page, which is also at \`<slug>.html\`.`

- [ ] **Step 5: The spec and TODO**

In the spec, set `**Status:** built 2026-11-10 (TODO §E55)` (use the actual date). Note any place the code ended up differing from the spec. In TODO §E55, replace "SPEC PROPOSED" with "BUILT", and replace **Next:** with the PR number once it is open. Add the plan link: `plan [\`2026-11-10-standalone-lesson-plan.md\`](2026-11-10-standalone-lesson-plan.md)`.

- [ ] **Step 6: Format, check, commit**

```bash
bun run format && bun run guards
git add COURSE_GUIDE.md README.md DEPLOY.md public/llms.txt docs/specs/2026-11-10-standalone-lesson-design.md docs/process/TODO.md
git commit -m "docs: a course of one lesson, with home in course.json"
```

---

### Task 9: The gate, then a pull request

- [ ] **Step 1: Run the full gate** (AGENTS.md)

```bash
bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e
```

Expected: all green. `test:coverage` holds each new file to its bar. If `course-json-disk.ts` or `course-lessons.ts` falls below its bar, add the missing case to its test rather than lowering the bar.

- [ ] **Step 2: From a folder, and at a fixed address** (AGENTS.md, hard constraint 3)

```bash
bun run build && SERVE_PATH=/any/folder/ bun run test:e2e e2e/home-page.spec.ts
BASE_URL=/course/ bun run build && BASE_URL=/course/ bun run test:e2e e2e/home-page.spec.ts
```

Expected: PASS. In lesson mode the header's course link resolves under the base, so if time allows, repeat both with `"home": "lesson"` set and reverted afterwards.

- [ ] **Step 3: Pull request** — use the `before-pr` skill. Push `feat/standalone-lesson` and open the PR against `main`. The body says what changes for courses: nothing, until a course sets `"home": "lesson"`.

---

## Self-review against the spec

| Spec section                                                   | Task                              |
| -------------------------------------------------------------- | --------------------------------- |
| §2 `home` setting, optional, default `"landing"`               | 1, 2                              |
| §2 exactly one lesson, counted as the landing page counts      | 4                                 |
| §2 `index.html` is the lesson; `<slug>.html` still written     | 6, 7                              |
| §2 header link unchanged                                       | 7 (course-link test)              |
| §2 `landingCopy` stays required                                | 2 (no change to it)               |
| §3 `courseLessonFolders`, `standaloneLessonFolder`, alias-free | 4                                 |
| §4 the build                                                   | 6                                 |
| §5 the dev server, read per request                            | 3, 5                              |
| §6 messages                                                    | 1, 4                              |
| §7 switching later                                             | 7 (both halves), 8 (COURSE_GUIDE) |
| §8 tests                                                       | 1–5, 7                            |
| §9 docs                                                        | 8                                 |
| §11 rollout                                                    | 9                                 |
