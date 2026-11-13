# GitHub Pages previews (E65) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every `lc-elearn` course's `main` to `https://lc-elearn.github.io/<repo>/`, and a landing page at `https://lc-elearn.github.io/` that lists them all automatically.

**Architecture:** Part A adds one workflow to the template (`pages.yml`) plus a tested check that no debug page reaches a course site; courses get it through the normal template update. Part B is a new public repo, `lc-elearn/lc-elearn.github.io`: a Bun + TypeScript script that asks the GitHub API for the organisation's published repos, reads each `course.json`, and writes one static HTML page, rebuilt hourly by Actions. Part C switches the courses on.

**Tech Stack:** GitHub Actions (`actions/configure-pages@v6.0.0`, `actions/upload-pages-artifact@v5.0.0`, `actions/deploy-pages@v5.0.1`), Bun 1.3, Node 22, TypeScript, Vitest 4, Zod 4.

**Spec:** [`docs/specs/2026-11-13-github-pages-previews-design.md`](../specs/2026-11-13-github-pages-previews-design.md). Section numbers (§) below are the spec's.

**Ground rules (AGENTS.md):** branch `docs/github-pages-previews` (already holds the spec); never push to `main`; one concern per commit; `bun run test`, never `bun test`, in the template; the full gate before the pull request. **Every step marked 🔒 changes something on GitHub: stop and get the maintainer's yes first.**

---

## File map

**Template (this repo)**

| File                               | Change | Responsibility                                           |
| ---------------------------------- | ------ | -------------------------------------------------------- |
| `src/build/debug-pages-in.ts`      | create | `findDebugPages(fileNames)`: which debug pages are there |
| `src/build/debug-pages-in.test.ts` | create | its tests                                                |
| `scripts/check-no-debug-pages.ts`  | create | CLI: exits 1 if `dist/` holds a debug page               |
| `.github/workflows/pages.yml`      | create | build and publish `main` to Pages (§3.1)                 |
| `DEPLOY.md`                        | modify | new section "Preview on GitHub Pages" (§3.3)             |
| `docs/ORGANIZATION.md`             | modify | step 6: switch Pages on (§3.2)                           |
| `docs/process/TODO.md`             | modify | §E65                                                     |

**Landing repo (`~/Sites/lc-elearn.github.io`, new)**

| File                                                                                                | Responsibility                                                                    |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.nvmrc`, `LICENSE`, `README.md` | project set-up                                                                    |
| `src/types.ts`                                                                                      | the shared shapes: `CourseInfo`, `Course`, `TemplateSite`, `Skipped`, `Collected` |
| `src/language.ts` (+ test)                                                                          | `languageName('ru')` → `"Russian"`                                                |
| `src/course-json.ts` (+ test)                                                                       | `parseCourseJson(text)` → info or a reason                                        |
| `src/render.ts` (+ test)                                                                            | `renderPage(...)` → the HTML string; escaping, sorting, wording                   |
| `src/collect.ts` (+ test)                                                                           | `collect(options)` → `Collected`; the only network code                           |
| `scripts/build.ts`                                                                                  | collect → render → write `site/index.html`; job summary                           |
| `site/styles.css`                                                                                   | the page's look, light and dark                                                   |
| `site/robots.txt`                                                                                   | `Disallow: /` for the whole host (§5)                                             |
| `.github/workflows/publish.yml`                                                                     | hourly build and publish (§4.4)                                                   |

---

## Part A — the template

### Task 1: `findDebugPages`, test first

**Files:**

- Create: `src/build/debug-pages-in.test.ts`
- Create: `src/build/debug-pages-in.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/build/debug-pages-in.test.ts
import { describe, expect, it } from 'vitest';
import { DEBUG_ENTRY_FILES } from './page-names';
import { findDebugPages } from './debug-pages-in';

describe('findDebugPages', () => {
  it('returns nothing for a course build', () => {
    expect(findDebugPages(['index.html', 'example.html', 'lo-01-greetings.html'])).toEqual([]);
  });

  it('names every debug page present, in the order given', () => {
    expect(findDebugPages(['index.html', 'ui-showcase.html', 'exercise-showcase.html'])).toEqual([
      'ui-showcase.html',
      'exercise-showcase.html',
    ]);
  });

  it('knows every page in DEBUG_ENTRY_FILES', () => {
    const all = Object.values(DEBUG_ENTRY_FILES);
    expect(findDebugPages(all)).toEqual(all);
  });

  it('ignores files that only contain a debug name', () => {
    expect(findDebugPages(['my-ui-showcase.html', 'ui-showcase.html.bak'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `bun run test src/build/debug-pages-in.test.ts`
Expected: FAIL, `Failed to resolve import "./debug-pages-in"`.

- [ ] **Step 3: Write the code**

```ts
// src/build/debug-pages-in.ts
/**
 * debug-pages-in.ts — which of a build's files are debug pages.
 *
 * The Pages workflow publishes a course build only when this finds none
 * (docs/specs/2026-11-13-github-pages-previews-design.md §3.1): the same list DEPLOY.md
 * step 6 check 3 asks a person to look for. Import-free beyond page-names.ts, so a Bun
 * script can use it (AGENTS.md, hard constraint 1).
 */
import { DEBUG_ENTRY_FILES } from './page-names';

const DEBUG_FILES: ReadonlySet<string> = new Set(Object.values(DEBUG_ENTRY_FILES));

/** The debug pages among `fileNames` (names only, not paths), in their given order. */
export function findDebugPages(fileNames: readonly string[]): string[] {
  return fileNames.filter((name) => DEBUG_FILES.has(name));
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `bun run test src/build/debug-pages-in.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/build/debug-pages-in.ts src/build/debug-pages-in.test.ts
git commit -m "feat(build): findDebugPages names the debug pages in a build (E65)"
```

### Task 2: the check script

**Files:**

- Create: `scripts/check-no-debug-pages.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/check-no-debug-pages.ts
/**
 * Fails (exit 1) when dist/ holds a debug page. Run by .github/workflows/pages.yml
 * before a course build is published (spec §3.1). The decision is
 * src/build/debug-pages-in.ts, which has the tests; this only reads the folder.
 */
import { readdirSync } from 'node:fs';
import { findDebugPages } from '../src/build/debug-pages-in';

const found = findDebugPages(readdirSync('dist'));
if (found.length > 0) {
  console.error(`dist/ holds debug pages and must not be published: ${found.join(', ')}`);
  process.exit(1);
}
console.log('dist/ holds no debug pages.');
```

- [ ] **Step 2: Check it both ways**

Run: `bun run build && bun scripts/check-no-debug-pages.ts`
Expected: `dist/ holds no debug pages.`, exit 0.

Run: `DEBUG=1 bun run build && bun scripts/check-no-debug-pages.ts; echo "exit $?"`
Expected: `dist/ holds debug pages and must not be published: …` listing six pages, `exit 1`.

Run: `bun run build` (leave a clean course build behind).

- [ ] **Step 3: Lint and commit**

Run: `bun run lint`
Expected: no errors. (If ESLint's `no-console` fires on `scripts/`, check how `scripts/prerender.tsx` logs and do the same.)

```bash
git add scripts/check-no-debug-pages.ts
git commit -m "feat(build): a script that fails when dist/ holds a debug page (E65)"
```

### Task 3: `pages.yml`

**Files:**

- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Pages

# Publishes main to GitHub Pages as a preview for the team and colleagues
# (docs/specs/2026-11-13-github-pages-previews-design.md). Not the live course: that is
# still built and uploaded by DEPLOY.md. Every course repo gets this file at its next
# template update; it does nothing until the repo switches Pages on
# (Settings → Pages → Source: GitHub Actions).

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Two quick merges publish in order; neither is cancelled.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  publish:
    name: Build and publish
    # Pages off (a course not yet switched on, a fork elsewhere): skip, no red ✗.
    if: github.event.repository.has_pages
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    env:
      # Debug pages on the template's preview only (spec §3.1, P3). Empty is off, so
      # every other repo, a renamed course included, builds the plain course.
      DEBUG: ${{ github.repository == 'lc-elearn/lc-base-template' && '1' || '' }}
    steps:
      # Same set-up as ci.yml; see its notes on each pin.
      - name: Checkout
        uses: actions/checkout@v5

      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: '1.3'

      - name: Set up Node
        uses: actions/setup-node@v7.0.0
        with:
          node-version-file: .nvmrc

      - name: Install dependencies
        run: bun install --frozen-lockfile

      # No tests here: main takes only pull requests that passed CI. No Feijoa fonts on
      # GitHub either (AGENTS.md, hard constraint 5), so headings use Open Sans.
      - name: Build
        run: bun run build

      - name: No debug pages in a course build
        if: env.DEBUG == ''
        run: bun scripts/check-no-debug-pages.ts

      - name: Configure Pages
        uses: actions/configure-pages@v6.0.0

      - name: Upload the site
        uses: actions/upload-pages-artifact@v5.0.0
        with:
          path: dist

      - name: Publish
        id: deploy
        uses: actions/deploy-pages@v5.0.1
```

- [ ] **Step 2: Check its syntax**

Run: `bunx prettier --check .github/workflows/pages.yml`
Expected: no issues (fix with `--write` if any).

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/pages.yml"); puts "ok"'`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: publish main to GitHub Pages as a preview (E65)"
```

### Task 4: the docs

**Files:**

- Modify: `DEPLOY.md` (new section after "Demo build for the team", before "Never")
- Modify: `docs/ORGANIZATION.md` (step 6)
- Modify: `docs/process/TODO.md`

Re-read each file immediately before editing it (AGENTS.md: Prettier reflows markdown).

- [ ] **Step 1: `DEPLOY.md`** — insert before `## Never`:

```markdown
## Preview on GitHub Pages

Every course repo can publish its `main` as a **preview** at
`https://lc-elearn.github.io/<repo>/`, listed on the landing page
`https://lc-elearn.github.io/`. It is for the team and colleagues to try the course as it
stands; it is **not** the live course, which is still built and uploaded by steps 1–9.

- **Switch it on once:** the repo's **Settings → Pages → Source: GitHub Actions**. From
  then on, every merge to `main` publishes (`.github/workflows/pages.yml`); before that,
  the workflow skips.
- **What it shows:** the course without the Feijoa fonts (headings in Open Sans) and
  without debug pages. Only the template's own preview has the debug pages.
- **Who can see it:** anyone with the link. Search engines are asked not to list it
  (`robots.txt` on the landing repo), but it is not private.

Design: [`docs/specs/2026-11-13-github-pages-previews-design.md`](docs/specs/2026-11-13-github-pages-previews-design.md).
```

- [ ] **Step 2: `docs/ORGANIZATION.md`** — in "Step 6 — Create a course repo", after the step that first pushes the course, add:

```markdown
- **Switch on its preview:** Settings → Pages → Source: **GitHub Actions**. The course
  then publishes to `https://lc-elearn.github.io/<repo>/` on every merge to `main` and
  appears on `https://lc-elearn.github.io/` within the hour
  ([`DEPLOY.md` → "Preview on GitHub Pages"](../DEPLOY.md#preview-on-github-pages)).
```

- [ ] **Step 3: `docs/process/TODO.md`** — under "## E. Before sharing with other developers", after the E64 entry, add:

```markdown
- **E65 — GitHub Pages previews and an organisation landing page. IN PROGRESS.** Every course publishes `main` to `https://lc-elearn.github.io/<repo>/` (`.github/workflows/pages.yml`, debug pages on the template only, `scripts/check-no-debug-pages.ts` stops a course build that has one); a new public repo, `lc-elearn/lc-elearn.github.io`, lists every course hourly from its `course.json`. Spec `docs/specs/2026-11-13-github-pages-previews-design.md`, plan `docs/process/2026-11-13-github-pages-previews-plan.md`. **Verify:** the template's preview opens at `/lc-base-template/` with its debug pages; a course preview has none; the landing page lists the template card.
```

- [ ] **Step 4: Format and commit**

Run: `bun run format`

```bash
git add DEPLOY.md docs/ORGANIZATION.md docs/process/TODO.md
git commit -m "docs: GitHub Pages previews in DEPLOY, ORGANIZATION and TODO (E65)"
```

### Task 5: the gate and the pull request

- [ ] **Step 1: Run the full gate**

Run: `bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e`
Expected: all pass; `src/build/debug-pages-in.ts` at 100% coverage. Note the test counts for the PR body.

- [ ] **Step 2: Check the branch** with the `before-pr` skill.

- [ ] **Step 3: 🔒 Push and open the pull request** (maintainer's yes first)

```bash
git push -u origin docs/github-pages-previews
gh pr create --title "feat: GitHub Pages previews for every course (E65)" --body-file <scratchpad>/pr-pages.md
```

The body: what the PR adds, that `pages.yml` skips until Pages is switched on, the gate results, a test plan (template preview after merge). End with the attribution line from the session's system reminder.

- [ ] **Step 4:** Wait for green CI and the maintainer's merge decision.

### Task 6: 🔒 switch on the template's preview

- [ ] **Step 1:** With the maintainer's yes, after the PR merges:

```bash
gh api -X POST repos/lc-elearn/lc-base-template/pages -f build_type=workflow
gh workflow run pages.yml --repo lc-elearn/lc-base-template --ref main
```

- [ ] **Step 2: Watch it**

Run: `gh run list --repo lc-elearn/lc-base-template --workflow pages.yml --limit 1`
Expected: `completed success` after a few minutes.

- [ ] **Step 3: Check the live site** in the built-in browser: `https://lc-elearn.github.io/lc-base-template/` (home), `example.html`, `exercise-showcase.html`, `ui-showcase.html`, `debug-sandbox.html`. Each loads with styles, no console errors, and no request to a root-absolute `/assets/…`.

---

## Part B — the landing repo

Work in a new folder, `~/Sites/lc-elearn.github.io`, with its own git history. Commit after each task on `main` locally; nothing is pushed until Task 13.

### Task 7: scaffold

**Files:** create `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.nvmrc`, `LICENSE`, `README.md`, `src/types.ts`

- [ ] **Step 1: Create the folder and files**

```bash
mkdir -p ~/Sites/lc-elearn.github.io/{src,scripts,site,.github/workflows} && cd ~/Sites/lc-elearn.github.io && git init -b main
```

`package.json`:

```json
{
  "name": "lc-elearn.github.io",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "bun scripts/build.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/bun": "^1.3.14",
    "prettier": "^3.8.4",
    "typescript": "~6.0.2",
    "vitest": "^4.1.10"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["bun"],
    "noEmit": true
  },
  "include": ["src", "scripts", "vitest.config.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

`.gitignore`:

```
node_modules/
site/index.html
```

`.nvmrc`: `22`

`LICENSE`: the MIT licence text, `Copyright (c) 2026 University of Cambridge`.

`README.md`:

```markdown
# lc-elearn.github.io

The landing page for the Language Centre's course previews:
**https://lc-elearn.github.io/**. It lists every `lc-elearn` repo that publishes to
GitHub Pages, from that repo's own `course.json`, and is rebuilt every hour by
`.github/workflows/publish.yml`. Nothing here is edited by hand per course: a course
appears once it switches Pages on.

- `bun install`, then `bun run test`, then `GITHUB_TOKEN=$(gh auth token) bun run build`
  to write `site/index.html` locally.
- Design: `lc-base-template`, `docs/specs/2026-11-13-github-pages-previews-design.md`.
```

`src/types.ts`:

```ts
/** What a course's course.json gives the landing page (spec §4.2). */
export interface CourseInfo {
  courseTitle: string;
  languageCode: string;
  blurb: string;
}

/** One course card. */
export interface Course extends CourseInfo {
  repo: string;
  siteUrl: string;
  repoUrl: string;
  lessons: number;
  updated: Date;
}

/** The template's card: its course.json is example text, so it is not read (§4.3). */
export interface TemplateSite {
  repo: string;
  siteUrl: string;
  repoUrl: string;
  updated: Date;
}

/** A published repo left off the page, and why. */
export interface Skipped {
  repo: string;
  reason: string;
}

export interface Collected {
  courses: Course[];
  template: TemplateSite | null;
  skipped: Skipped[];
}
```

- [ ] **Step 2: Install and check**

Run: `bun install && bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold the landing page project"
```

### Task 8: `languageName`, test first

- [ ] **Step 1: Write the failing test** — `src/language.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { languageName } from './language';

describe('languageName', () => {
  it('names known codes in English', () => {
    expect(languageName('ru')).toBe('Russian');
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('de')).toBe('German');
    expect(languageName('fr')).toBe('French');
  });

  it('returns an unknown or malformed code as given', () => {
    expect(languageName('zz')).toBe('zz');
    expect(languageName('not a code')).toBe('not a code');
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test src/language.test.ts`
Expected: FAIL, cannot resolve `./language`.

- [ ] **Step 3: Write the code** — `src/language.ts`:

```ts
const NAMES = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' });

/** `ru` → "Russian". An unknown or malformed code comes back unchanged. */
export function languageName(code: string): string {
  try {
    return NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}
```

- [ ] **Step 4: Run it, see it pass**

Run: `bun run test src/language.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/language.ts src/language.test.ts && git commit -m "feat: name a course's language from its code"
```

### Task 9: `parseCourseJson`, test first

- [ ] **Step 1: Write the failing test** — `src/course-json.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCourseJson } from './course-json';

const VALID = JSON.stringify({
  courseTitle: 'Russian Basic Vocabulary',
  languageCode: 'ru',
  landingCopy: { heading: 'Базовая лексика', subheading: 'Build up your Russian vocabulary' },
  logo: 'logo.svg',
});

describe('parseCourseJson', () => {
  it('reads title, language and the subheading as blurb', () => {
    expect(parseCourseJson(VALID)).toEqual({
      ok: true,
      info: {
        courseTitle: 'Russian Basic Vocabulary',
        languageCode: 'ru',
        blurb: 'Build up your Russian vocabulary',
      },
    });
  });

  it('gives a reason for text that is not JSON', () => {
    expect(parseCourseJson('{ nope')).toEqual({
      ok: false,
      reason: 'course.json is not valid JSON',
    });
  });

  it('names a missing field', () => {
    const result = parseCourseJson(
      JSON.stringify({ languageCode: 'ru', landingCopy: { subheading: 'x' } }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('courseTitle');
  });

  it('names a field of the wrong type', () => {
    const result = parseCourseJson(
      JSON.stringify({ courseTitle: 'T', languageCode: 7, landingCopy: { subheading: 'x' } }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('languageCode');
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test src/course-json.test.ts`
Expected: FAIL, cannot resolve `./course-json`.

- [ ] **Step 3: Write the code** — `src/course-json.ts`:

```ts
import { z } from 'zod';
import type { CourseInfo } from './types';

/** Only the fields the landing page uses; a course.json may hold more. */
const COURSE_JSON = z.object({
  courseTitle: z.string().min(1),
  languageCode: z.string().min(2),
  landingCopy: z.object({ subheading: z.string().min(1) }),
});

export type CourseJsonResult = { ok: true; info: CourseInfo } | { ok: false; reason: string };

/** A course.json's text → the card's info, or why it cannot be used. */
export function parseCourseJson(text: string): CourseJsonResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'course.json is not valid JSON' };
  }
  const parsed = COURSE_JSON.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return { ok: false, reason: `course.json: ${issues.join('; ')}` };
  }
  const { courseTitle, languageCode, landingCopy } = parsed.data;
  return { ok: true, info: { courseTitle, languageCode, blurb: landingCopy.subheading } };
}
```

- [ ] **Step 4: Run it, see it pass**

Run: `bun run test src/course-json.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/course-json.ts src/course-json.test.ts && git commit -m "feat: read and check a course's course.json"
```

### Task 10: `renderPage`, test first

- [ ] **Step 1: Write the failing test** — `src/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { escapeHtml, formatDate, lessonLabel, renderPage, sortCourses } from './render';
import type { Course, TemplateSite } from './types';

const UPDATED = new Date('2026-11-13T12:01:00Z');

function course(overrides: Partial<Course> = {}): Course {
  return {
    repo: 'lc-russian-basic-vocabulary',
    siteUrl: 'https://lc-elearn.github.io/lc-russian-basic-vocabulary/',
    repoUrl: 'https://github.com/lc-elearn/lc-russian-basic-vocabulary',
    courseTitle: 'Russian Basic Vocabulary',
    languageCode: 'ru',
    blurb: 'Build up your Russian vocabulary',
    lessons: 6,
    updated: UPDATED,
    ...overrides,
  };
}

const TEMPLATE: TemplateSite = {
  repo: 'lc-base-template',
  siteUrl: 'https://lc-elearn.github.io/lc-base-template/',
  repoUrl: 'https://github.com/lc-elearn/lc-base-template',
  updated: UPDATED,
};

describe('escapeHtml', () => {
  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});

describe('lessonLabel', () => {
  it('words the count', () => {
    expect(lessonLabel(0)).toBe('No lessons yet');
    expect(lessonLabel(1)).toBe('1 lesson');
    expect(lessonLabel(6)).toBe('6 lessons');
  });
});

describe('formatDate', () => {
  it('uses UK order in London time', () => {
    expect(formatDate(new Date('2026-11-13T23:30:00Z'))).toBe('13 Nov 2026');
    expect(formatDate(new Date('2026-07-01T23:30:00Z'))).toBe('2 Jul 2026');
  });
});

describe('sortCourses', () => {
  it('sorts by language name, then title, without changing the input', () => {
    const input = [
      course({ languageCode: 'ru', courseTitle: 'B' }),
      course({ languageCode: 'de', courseTitle: 'Z' }),
      course({ languageCode: 'ru', courseTitle: 'A' }),
    ];
    const sorted = sortCourses(input);
    expect(sorted.map((c) => `${c.languageCode} ${c.courseTitle}`)).toEqual([
      'de Z',
      'ru A',
      'ru B',
    ]);
    expect(input[0]?.courseTitle).toBe('B');
  });
});

describe('renderPage', () => {
  const html = renderPage({ courses: [course()], template: TEMPLATE, refreshed: UPDATED });

  it('asks search engines not to index it', () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it('shows a course card with every field', () => {
    expect(html).toContain('Russian Basic Vocabulary');
    expect(html).toContain('Russian');
    expect(html).toContain('Build up your Russian vocabulary');
    expect(html).toContain('6 lessons');
    expect(html).toContain('Updated 13 Nov 2026');
    expect(html).toContain('href="https://lc-elearn.github.io/lc-russian-basic-vocabulary/"');
    expect(html).toContain(
      'Open course<span class="visually-hidden">: Russian Basic Vocabulary</span>',
    );
    expect(html).toContain('href="https://github.com/lc-elearn/lc-russian-basic-vocabulary"');
  });

  it('shows the template card with its debug pages, after the courses', () => {
    expect(html).toContain('Course template');
    expect(html).toContain('exercise-showcase.html');
    expect(html).toContain('ui-showcase.html');
    expect(html).toContain('debug-sandbox.html');
    expect(html.indexOf('Russian Basic Vocabulary')).toBeLessThan(html.indexOf('Course template'));
  });

  it('says when it was refreshed', () => {
    expect(html).toContain('Refreshed 13 Nov 2026, 12:01');
  });

  it('escapes course text', () => {
    const page = renderPage({
      courses: [course({ courseTitle: 'A <b>bold</b> "title"' })],
      template: null,
      refreshed: UPDATED,
    });
    expect(page).toContain('A &lt;b&gt;bold&lt;/b&gt; &quot;title&quot;');
    expect(page).not.toContain('<b>bold</b>');
  });

  it('says so when there are no courses and no template', () => {
    expect(renderPage({ courses: [], template: null, refreshed: UPDATED })).toContain(
      'No courses are published yet.',
    );
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test src/render.test.ts`
Expected: FAIL, cannot resolve `./render`.

- [ ] **Step 3: Write the code** — `src/render.ts`:

```ts
import { languageName } from './language';
import type { Course, TemplateSite } from './types';

const TIME_ZONE = 'Europe/London';
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
});

/** The template's debug pages its card links to (spec §4.3). */
const TEMPLATE_PAGES: readonly { file: string; label: string }[] = [
  { file: '', label: 'Home page' },
  { file: 'exercise-showcase.html', label: 'Exercise showcase' },
  { file: 'ui-showcase.html', label: 'UI showcase' },
  { file: 'debug-sandbox.html', label: 'Sandbox' },
];

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function lessonLabel(count: number): string {
  if (count === 0) return 'No lessons yet';
  return count === 1 ? '1 lesson' : `${count} lessons`;
}

export function formatDate(date: Date): string {
  return DATE.format(date);
}

function formatDateTime(date: Date): string {
  return `${DATE.format(date)}, ${TIME.format(date)}`;
}

/** A–Z by language name, then by title. Returns a new array. */
export function sortCourses(courses: readonly Course[]): Course[] {
  return [...courses].sort(
    (a, b) =>
      languageName(a.languageCode).localeCompare(languageName(b.languageCode), 'en') ||
      a.courseTitle.localeCompare(b.courseTitle, 'en'),
  );
}

function courseCard(course: Course): string {
  const title = escapeHtml(course.courseTitle);
  return `
      <li>
        <article class="card">
          <p class="card-language">${escapeHtml(languageName(course.languageCode))}</p>
          <h2 class="card-title">${title}</h2>
          <p class="card-blurb">${escapeHtml(course.blurb)}</p>
          <p class="card-meta">${lessonLabel(course.lessons)} · Updated ${formatDate(course.updated)}</p>
          <p class="card-links">
            <a class="card-open" href="${escapeHtml(course.siteUrl)}">Open course<span class="visually-hidden">: ${title}</span></a>
            <a class="card-source" href="${escapeHtml(course.repoUrl)}">Source on GitHub</a>
          </p>
        </article>
      </li>`;
}

function templateCard(template: TemplateSite): string {
  const links = TEMPLATE_PAGES.map(
    ({ file, label }) => `<li><a href="${escapeHtml(template.siteUrl + file)}">${label}</a></li>`,
  ).join('');
  return `
    <section class="template" aria-labelledby="template-heading">
      <h2 id="template-heading">Course template</h2>
      <p>The starting point every course is made from, with its example lesson and the pages for testing every exercise type.</p>
      <ul class="template-links">${links}</ul>
      <p class="card-meta">Updated ${formatDate(template.updated)} · <a href="${escapeHtml(template.repoUrl)}">Source on GitHub</a></p>
    </section>`;
}

export interface PageInput {
  courses: readonly Course[];
  template: TemplateSite | null;
  refreshed: Date;
}

/** The whole landing page. Every value from a course is escaped. */
export function renderPage({ courses, template, refreshed }: PageInput): string {
  const cards = sortCourses(courses).map(courseCard).join('');
  const list =
    courses.length > 0
      ? `<ul class="cards">${cards}\n    </ul>`
      : '<p>No courses are published yet.</p>';
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>LC eLearning course previews</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main>
      <header class="intro">
        <h1>Course previews</h1>
        <p>The Language Centre's courses as they stand on <code>main</code>, for the team and colleagues to try. These are previews, not the live courses.</p>
      </header>
    ${list}
    ${template ? templateCard(template) : ''}
    </main>
    <footer>Refreshed ${formatDateTime(refreshed)}</footer>
  </body>
</html>
`;
}
```

- [ ] **Step 4: Run it, see it pass**

Run: `bun run test src/render.test.ts`
Expected: PASS, 10 tests. (12:01 UTC on 13 Nov is 12:01 in London, GMT.)

- [ ] **Step 5: Commit**

```bash
git add src/render.ts src/render.test.ts && git commit -m "feat: render the landing page from a list of courses"
```

### Task 11: `collect`, test first

- [ ] **Step 1: Write the failing test** — `src/collect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collect } from './collect';

const API = 'https://api.github.com';
const COURSE_JSON = JSON.stringify({
  courseTitle: 'Russian',
  languageCode: 'ru',
  landingCopy: { subheading: 'Blurb' },
});

function repo(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    html_url: `https://github.com/lc-elearn/${name}`,
    has_pages: true,
    archived: false,
    is_template: false,
    default_branch: 'main',
    ...extra,
  };
}

/** A fake fetch: URL → [status, body]. An unlisted URL is a 404. */
function fakeFetch(routes: Record<string, [number, unknown]>) {
  return async (url: string): Promise<Response> => {
    const [status, body] = routes[url] ?? [404, { message: 'Not Found' }];
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
}

function repoRoutes(name: string, courseJson: [number, unknown] = [200, COURSE_JSON]) {
  return {
    [`${API}/repos/lc-elearn/${name}/contents/course.json?ref=main`]: courseJson,
    [`${API}/repos/lc-elearn/${name}/contents/lo-config?ref=main`]: [
      200,
      [
        { name: 'lo-00-example', type: 'dir' },
        { name: 'lo-01-family', type: 'dir' },
        { name: 'lo-02-work', type: 'dir' },
        { name: 'README.md', type: 'file' },
      ],
    ],
    [`${API}/repos/lc-elearn/${name}/commits?sha=main&per_page=1`]: [
      200,
      [{ commit: { committer: { date: '2026-11-13T12:01:00Z' } } }],
    ],
  } satisfies Record<string, [number, unknown]>;
}

const ORG_URL = `${API}/orgs/lc-elearn/repos?type=public&per_page=100&page=1`;
const OPTIONS = { org: 'lc-elearn', selfRepo: 'lc-elearn.github.io' };

describe('collect', () => {
  it('builds a course from a published repo', async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({ [ORG_URL]: [200, [repo('lc-russian')]], ...repoRoutes('lc-russian') }),
    });
    expect(result.courses).toEqual([
      {
        repo: 'lc-russian',
        siteUrl: 'https://lc-elearn.github.io/lc-russian/',
        repoUrl: 'https://github.com/lc-elearn/lc-russian',
        courseTitle: 'Russian',
        languageCode: 'ru',
        blurb: 'Blurb',
        lessons: 2,
        updated: new Date('2026-11-13T12:01:00Z'),
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('leaves out repos without Pages, archived repos and itself', async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [
          200,
          [
            repo('no-pages', { has_pages: false }),
            repo('old', { archived: true }),
            repo('lc-elearn.github.io'),
          ],
        ],
      }),
    });
    expect(result).toEqual({ courses: [], template: null, skipped: [] });
  });

  it('makes the template repo the template card, without reading its course.json', async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo('lc-base-template', { is_template: true })]],
        [`${API}/repos/lc-elearn/lc-base-template/commits?sha=main&per_page=1`]: [
          200,
          [{ commit: { committer: { date: '2026-11-12T10:00:00Z' } } }],
        ],
      }),
    });
    expect(result.template).toEqual({
      repo: 'lc-base-template',
      siteUrl: 'https://lc-elearn.github.io/lc-base-template/',
      repoUrl: 'https://github.com/lc-elearn/lc-base-template',
      updated: new Date('2026-11-12T10:00:00Z'),
    });
    expect(result.courses).toEqual([]);
  });

  it('skips a repo with no course.json, with a reason, and keeps the others', async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo('lc-russian'), repo('not-a-course')]],
        ...repoRoutes('lc-russian'),
        ...repoRoutes('not-a-course', [404, { message: 'Not Found' }]),
      }),
    });
    expect(result.courses.map((c) => c.repo)).toEqual(['lc-russian']);
    expect(result.skipped).toEqual([{ repo: 'not-a-course', reason: 'no course.json on main' }]);
  });

  it('skips a repo whose course.json is invalid', async () => {
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({
        [ORG_URL]: [200, [repo('broken')]],
        ...repoRoutes('broken', [200, '{ nope']),
      }),
    });
    expect(result.skipped).toEqual([{ repo: 'broken', reason: 'course.json is not valid JSON' }]);
  });

  it('counts no lessons when lo-config is missing', async () => {
    const routes = repoRoutes('lc-new');
    delete (routes as Record<string, unknown>)[
      `${API}/repos/lc-elearn/lc-new/contents/lo-config?ref=main`
    ];
    const result = await collect({
      ...OPTIONS,
      fetch: fakeFetch({ [ORG_URL]: [200, [repo('lc-new')]], ...routes }),
    });
    expect(result.courses[0]?.lessons).toBe(0);
  });

  it('throws when the organisation cannot be listed', async () => {
    await expect(
      collect({ ...OPTIONS, fetch: fakeFetch({ [ORG_URL]: [500, { message: 'boom' }] }) }),
    ).rejects.toThrow('GitHub API 500');
  });

  it('sends the token when given one', async () => {
    const seen: (string | null)[] = [];
    const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
      seen.push(new Headers(init?.headers).get('authorization'));
      return new Response(JSON.stringify(url === ORG_URL ? [] : {}), { status: 200 });
    };
    await collect({ ...OPTIONS, token: 'abc', fetch });
    expect(seen).toEqual(['Bearer abc']);
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun run test src/collect.test.ts`
Expected: FAIL, cannot resolve `./collect`.

- [ ] **Step 3: Write the code** — `src/collect.ts`:

```ts
/**
 * collect.ts — asks GitHub which lc-elearn repos publish a site, and reads each one's
 * course.json, lesson folders and last commit (spec §4.2). The only file that touches
 * the network; `fetch` is injectable so the tests never do.
 */
import { parseCourseJson } from './course-json';
import type { Collected, Course, Skipped, TemplateSite } from './types';

const API = 'https://api.github.com';
const PAGE_SIZE = 100;
const LESSON_FOLDER = /^lo-\d+-/;
const EXAMPLE_LESSON = 'lo-00-example';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface CollectOptions {
  org: string;
  /** This landing repo's own name, never listed. */
  selfRepo: string;
  token?: string;
  fetch?: Fetch;
}

interface RepoSummary {
  name: string;
  html_url: string;
  has_pages: boolean;
  archived: boolean;
  is_template: boolean;
  default_branch: string;
}

class NotFound extends Error {}

export async function collect(options: CollectOptions): Promise<Collected> {
  const get = makeGet(options);
  const repos = (await listRepos(get, options.org)).filter(
    (repo) => repo.has_pages && !repo.archived && repo.name !== options.selfRepo,
  );
  const courses: Course[] = [];
  const skipped: Skipped[] = [];
  let template: TemplateSite | null = null;

  for (const repo of repos) {
    const base = `/repos/${options.org}/${repo.name}`;
    const siteUrl = `https://${options.org}.github.io/${repo.name}/`;
    try {
      const updated = await lastCommitDate(get, base, repo.default_branch);
      if (repo.is_template) {
        template = { repo: repo.name, siteUrl, repoUrl: repo.html_url, updated };
        continue;
      }
      const text = await get(`${base}/contents/course.json?ref=${repo.default_branch}`, true).catch(
        (error) => {
          if (error instanceof NotFound)
            throw new Error(`no course.json on ${repo.default_branch}`);
          throw error;
        },
      );
      const parsed = parseCourseJson(text);
      if (!parsed.ok) {
        skipped.push({ repo: repo.name, reason: parsed.reason });
        continue;
      }
      const lessons = await countLessons(get, base, repo.default_branch);
      courses.push({
        repo: repo.name,
        siteUrl,
        repoUrl: repo.html_url,
        ...parsed.info,
        lessons,
        updated,
      });
    } catch (error) {
      skipped.push({
        repo: repo.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { courses, template, skipped };
}

/** GET a GitHub API path: the body as text. A 404 throws NotFound; any other failure, an Error. */
function makeGet({ token, fetch = globalThis.fetch }: CollectOptions) {
  return async (path: string, raw = false): Promise<string> => {
    const headers: Record<string, string> = {
      accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(`${API}${path}`, { headers });
    if (response.status === 404) throw new NotFound(path);
    if (!response.ok) throw new Error(`GitHub API ${response.status} on ${path}`);
    return response.text();
  };
}

type Get = ReturnType<typeof makeGet>;

async function listRepos(get: Get, org: string): Promise<RepoSummary[]> {
  const all: RepoSummary[] = [];
  for (let page = 1; ; page += 1) {
    const batch = JSON.parse(
      await get(`/orgs/${org}/repos?type=public&per_page=${PAGE_SIZE}&page=${page}`),
    ) as RepoSummary[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return all;
  }
}

async function lastCommitDate(get: Get, base: string, branch: string): Promise<Date> {
  const commits = JSON.parse(await get(`${base}/commits?sha=${branch}&per_page=1`)) as {
    commit: { committer: { date: string } };
  }[];
  const date = commits[0]?.commit.committer.date;
  if (!date) throw new Error(`no commits on ${branch}`);
  return new Date(date);
}

async function countLessons(get: Get, base: string, branch: string): Promise<number> {
  try {
    const entries = JSON.parse(await get(`${base}/contents/lo-config?ref=${branch}`)) as {
      name: string;
      type: string;
    }[];
    return entries.filter(
      (e) => e.type === 'dir' && LESSON_FOLDER.test(e.name) && e.name !== EXAMPLE_LESSON,
    ).length;
  } catch (error) {
    if (error instanceof NotFound) return 0;
    throw error;
  }
}
```

Note: the "sends the token" test's org list is `[]`, so only the one request is made; its `seen` is `['Bearer abc']`.

- [ ] **Step 4: Run it, see it pass**

Run: `bun run test`
Expected: PASS, every file (24 tests).

- [ ] **Step 5: Commit**

```bash
git add src/collect.ts src/collect.test.ts && git commit -m "feat: collect the published courses from the GitHub API"
```

### Task 12: the build script, styles, robots.txt, dry run

- [ ] **Step 1: `scripts/build.ts`**

```ts
/**
 * Collects the courses and writes site/index.html. Run by publish.yml every hour;
 * locally: GITHUB_TOKEN=$(gh auth token) bun run build. A skipped repo is reported
 * (and in the Actions job summary) but does not fail the build; a failed org listing
 * does, so the last good page stays up (spec §6).
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { collect } from '../src/collect';
import { renderPage } from '../src/render';

const result = await collect({
  org: 'lc-elearn',
  selfRepo: 'lc-elearn.github.io',
  token: process.env.GITHUB_TOKEN,
});
writeFileSync('site/index.html', renderPage({ ...result, refreshed: new Date() }));

const lines = [
  `Courses: ${result.courses.map((c) => c.repo).join(', ') || 'none'}`,
  `Template: ${result.template?.repo ?? 'none'}`,
  ...result.skipped.map((s) => `Skipped: ${s.repo}: ${s.reason}`),
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Landing page\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`,
  );
}
```

- [ ] **Step 2: `site/robots.txt`**

```
# Keeps every site on lc-elearn.github.io out of search engines: the landing page and
# every course preview share this host. Spec §5.
User-agent: *
Disallow: /
```

- [ ] **Step 3: `site/styles.css`** — the LC palette from `lc-base-template/src/styles/palette.css`:

```css
:root {
  --paper: #fbf9f4;
  --surface: #fff;
  --text: #232830;
  --muted: #546072;
  --line: #b5bdc8;
  --accent: #133844;
  --accent-text: #fff;
  --highlight: #00bdb6;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 3rem;
  --radius: 0.75rem;
  color-scheme: light dark;
  font-family:
    'Open Sans',
    system-ui,
    -apple-system,
    'Segoe UI',
    sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #12161c;
    --surface: #1b2129;
    --text: #eceef1;
    --muted: #b5bdc8;
    --line: #2e3640;
    --accent: #8ee8d8;
    --accent-text: #133844;
    --highlight: #8ee8d8;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--text);
  line-height: 1.5;
}

main,
footer {
  max-width: 72rem;
  margin: 0 auto;
  padding: var(--space-4) var(--space-2);
}

.intro {
  max-width: 44rem;
  margin-bottom: var(--space-4);
}
.intro h1 {
  font-size: clamp(2rem, 1.4rem + 3vw, 3.25rem);
  line-height: 1.1;
  margin: 0 0 var(--space-2);
}
.intro p {
  color: var(--muted);
  font-size: 1.125rem;
  margin: 0;
}

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
}

.card {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-top: 4px solid var(--highlight);
  border-radius: var(--radius);
}

.card-language {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.card-title {
  margin: 0;
  font-size: 1.375rem;
  line-height: 1.25;
}
.card-blurb {
  margin: 0;
  flex-grow: 1;
}
.card-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.9375rem;
}
.card-links {
  margin: var(--space-1) 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.card-open {
  padding: var(--space-1) var(--space-2);
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
  text-decoration: none;
}
.card-open:hover {
  text-decoration: underline;
}

a {
  color: inherit;
  text-underline-offset: 0.2em;
}
a:focus-visible {
  outline: 3px solid var(--highlight);
  outline-offset: 3px;
}

.template {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border: 1px dashed var(--line);
  border-radius: var(--radius);
}
.template h2 {
  margin: 0 0 var(--space-1);
}
.template p {
  margin: 0 0 var(--space-2);
  color: var(--muted);
}
.template-links {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

footer {
  padding-top: 0;
  color: var(--muted);
  font-size: 0.875rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 4: Dry run against the real organisation**

Run: `GITHUB_TOKEN=$(gh auth token) bun run build`
Expected (before Part A's Task 6): `Courses: none`, `Template: none` (no repo has Pages yet). After Task 6: `Template: lc-base-template`.

Open `site/index.html` in the built-in browser (`file://` path); check light and dark, and phone width (375 px): no horizontal scroll, cards stack.

- [ ] **Step 5: Typecheck, format, commit**

Run: `bun run typecheck && bun run format && bun run test`
Expected: all pass.

```bash
git add -A && git commit -m "feat: build script, styles and robots.txt for the landing page"
```

### Task 13: `publish.yml`, then 🔒 create and publish the repo

- [ ] **Step 1: `.github/workflows/publish.yml`**

```yaml
name: Publish

# Rebuilds the landing page from the organisation's published repos (spec §4.4):
# hourly, on "Run workflow", and on a push to main. Public repo: Actions are free.

on:
  schedule:
    - cron: '17 * * * *'
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: '1.3'
      - uses: actions/setup-node@v7.0.0
        with:
          node-version-file: .nvmrc
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run test
      - name: Build the page
        run: bun run build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/configure-pages@v6.0.0
      - uses: actions/upload-pages-artifact@v5.0.0
        with:
          path: site
      - id: deploy
        uses: actions/deploy-pages@v5.0.1
```

Commit: `git add -A && git commit -m "ci: publish the landing page hourly"`.

- [ ] **Step 2: 🔒 Create the repo, push, switch Pages on** (maintainer's yes first)

```bash
cd ~/Sites/lc-elearn.github.io
gh repo create lc-elearn/lc-elearn.github.io --public --source . --push \
  --description "Landing page for the LC eLearning course previews"
gh api -X POST repos/lc-elearn/lc-elearn.github.io/pages -f build_type=workflow
gh workflow run publish.yml --repo lc-elearn/lc-elearn.github.io --ref main
```

- [ ] **Step 3: Check it**

Run: `gh run list --repo lc-elearn/lc-elearn.github.io --limit 1` → `completed success`.
Open `https://lc-elearn.github.io/` in the built-in browser: the template card shows, with working links; `https://lc-elearn.github.io/robots.txt` shows `Disallow: /`.

- [ ] **Step 4: Protect `main`** the way ORGANIZATION.md step 5 protects the template's, if the maintainer wants pull requests here too (ask).

---

## Part C — the courses

### Task 14: 🔒 each course, Russian first

For each course, with its owner's agreement:

- [ ] **Step 1:** Bring the template update in with the `sync-from-template` skill (it carries `pages.yml`, `src/build/debug-pages-in.ts`, `scripts/check-no-debug-pages.ts`). The course's author opens and merges that pull request.
- [ ] **Step 2:** Switch Pages on:

```bash
gh api -X POST repos/lc-elearn/<repo>/pages -f build_type=workflow
gh workflow run pages.yml --repo lc-elearn/<repo> --ref main
```

- [ ] **Step 3:** Check `https://lc-elearn.github.io/<repo>/`: home and every lesson load, and `https://lc-elearn.github.io/<repo>/exercise-showcase.html` is a 404. Within the hour (or after `gh workflow run publish.yml --repo lc-elearn/lc-elearn.github.io`) the course's card is on the landing page with the right lesson count.

Order: `lc-russian-basic-vocabulary`, then `lc-spanish-essentials`, `lc-german-basic`, `lc-french-academic-reading`.

### Task 15: write it down

- [ ] In `docs/process/TODO.md`, mark E65 done with the dates, PR numbers and the courses switched on; update the spec's **Status** line; record the landing page's address in `lc-hub`'s README (its own pull request there).
