# GitHub Pages previews: every course online, one landing page (E65)

**Date:** 2026-11-13 · **Status:** template part built on branch docs/github-pages-previews; landing repo built
locally; not yet published · **Plan:**
[`2026-11-13-github-pages-previews-plan.md`](../process/2026-11-13-github-pages-previews-plan.md)
**TODO:** §E65 · **Touches:** `.github/workflows/` (new `pages.yml`),
`src/build/debug-pages-in.ts` (+ test), `scripts/check-no-debug-pages.ts`, `DEPLOY.md`,
`docs/ORGANIZATION.md`; and a new repo, `lc-elearn/lc-elearn.github.io`

## 1. Why

The `lc-elearn` organisation now has the template and four courses made from it: French (`lc-french-academic-reading`), German (`lc-german-basic`), Spanish
(`lc-spanish-essentials`) and Russian (`lc-russian-basic-vocabulary`, being built now).
Today the only way to see a course is to clone it and build it, or wait for an upload to
the live server. The maintainer wants one place where the team **and colleagues** can open
every course as it stands on `main`, click through it and test it in a browser.

GitHub Pages does this for free: every course repo is public, and the organisation is on
the free plan, which serves Pages from public repos only.

## 2. Decisions (maintainer, 2026-11-13)

| #   | Decision                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Audience: team and colleagues.** Sites are public by link but kept out of search engines. Not a public showcase.                      |
| P2  | **Layout.** A landing page at `https://lc-elearn.github.io/`; each course at `https://lc-elearn.github.io/<repo>/`.                     |
| P3  | **Debug pages on the template's site only.** Course sites are the course, as students will see it.                                      |
| P4  | **Automatic listing.** A new course appears on the landing page without anyone editing a list.                                          |
| P5  | **Card contents:** title, language, blurb, number of lessons, last updated. Not who builds it (that lives in the private `lc-hub`).     |
| P6  | **The landing page is built by a scheduled job** (approach A), not in the visitor's browser (B, rate limits) or by hand (C, ruled out). |

## 3. The course sites

### 3.1 One new workflow in the template: `.github/workflows/pages.yml`

- **Runs on** a push to `main` and on `workflow_dispatch` (the "Run workflow" button).
- **Skips quietly when Pages is off:** the job has
  `if: github.event.repository.has_pages`. A course that has not switched Pages on, or a
  fork outside the organisation, gets a skipped run, not a red ✗.
- **Builds as CI does:** the same Bun and Node set-up as `ci.yml` (Bun `1.3`, Node from
  `.nvmrc`), `bun install --frozen-lockfile`, then `bun run build`. It does not run the
  tests again: `main` takes only pull requests that passed CI.
- **Debug pages on the template only (P3):** `DEBUG=1` is set when
  `github.repository == 'lc-elearn/lc-base-template'`, and only then. Every other repo,
  including a course renamed later, builds without it. A check before publishing fails
  the job if a non-template build contains any page from `DEBUG_ENTRY_FILES`
  (`src/build/page-names.ts`), the same list `DEPLOY.md` step 6 check 3 names.
- **Publishes** `dist/` with GitHub's own Pages actions (configure, upload the artifact,
  deploy), at exact version tags old enough for the repo's two-week rule (`ci.yml`'s note
  on `setup-node`). Permissions: `contents: read`, `pages: write`, `id-token: write`.
  Concurrency group `pages`, not cancelled in progress, so two quick merges publish in
  order.
- **Addresses need no change.** The default base is `./` (`src/build/build-base.ts`), and
  CI's browser tests already serve the build from a nested folder, so
  `/lc-russian-basic-vocabulary/` works as built.
- **Fonts:** the Feijoa files are git-ignored and licensed (AGENTS.md, hard constraint 5),
  so a Pages build has none and headings fall back to Open Sans. Correct, not a fault.

### 3.2 Reaching the courses

`pages.yml` is a template file, so each course gets it at its next template update
(`sync-from-template` skill, ORGANIZATION.md step 9). Each course then switches Pages on
once: **Settings → Pages → Source: GitHub Actions**. That needs admin on the repo, and
the course's owner agrees first.

### 3.3 Docs

- `DEPLOY.md`: a short section "Preview on GitHub Pages" beside "Demo build for the team":
  what the preview is, that it is not the live course, where it is, how to switch it on.
- `docs/ORGANIZATION.md` step 6 (create a course repo): one line, switch Pages on.
- `docs/process/TODO.md`: §E65.

## 4. The landing page

### 4.1 A new public repo: `lc-elearn/lc-elearn.github.io`

GitHub serves an organisation's `<org>.github.io` repo at the root,
`https://lc-elearn.github.io/`. It cannot live in `lc-hub`, which is private (§1).

| Path                            | What it holds                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `src/course-json.ts`            | reads and checks one `course.json` (Zod): `courseTitle`, `languageCode`, `landingCopy` |
| `src/language.ts`               | `ru` → "Russian", with `Intl.DisplayNames`; an unknown code shows as itself            |
| `src/collect.ts`                | asks GitHub for the courses (§4.2); the only file that talks to the network            |
| `src/render.ts`                 | the page's HTML from a list of courses; escapes every value                            |
| `src/*.test.ts`                 | tests beside each file (Vitest)                                                        |
| `scripts/build.ts`              | runs collect, then render, writes `site/`                                              |
| `site/styles.css`               | the page's styles: LC palette colours, light and dark, phone width up                  |
| `site/robots.txt`               | `User-agent: *` / `Disallow: /` (§5)                                                   |
| `.github/workflows/publish.yml` | runs `scripts/build.ts` and publishes `site/`                                          |

Bun and TypeScript, like the template, so the same people can maintain it. Licence: the
template's (MIT for code). Under 800 lines a file.

### 4.2 Finding the courses (P4)

`collect.ts`, with the workflow's own `GITHUB_TOKEN` (read access to public repos is
enough; no secret is added anywhere):

1. List the organisation's repos (`GET /orgs/lc-elearn/repos`, public, 100 a page).
2. Keep those with `has_pages`, not archived, and not `lc-elearn.github.io` itself.
3. For each, on its default branch:
   - **`course.json`**: title, language code, and `landingCopy.subheading` as the blurb.
     Missing or invalid: the repo is skipped (§6).
   - **Lessons:** the folders in `lo-config/` named `lo-NN-…`, not counting
     `lo-00-example`.
   - **Last updated:** the date of the latest commit on the default branch.
4. A repo with `is_template` becomes the template card (§4.3), not a course card.

About 3 API calls a repo: 20 for today's 6 repos, far inside `GITHUB_TOKEN`'s 1,000 an
hour.

### 4.3 The page

- **Heading and one line** saying what the page is: previews of the Language Centre's
  courses as they stand on `main`, not the live courses.
- **One card per course**, sorted A–Z by language name, then title:
  - the title, as a heading;
  - the language ("Russian");
  - the blurb;
  - "6 lessons" ("1 lesson"; "No lessons yet" for 0);
  - "Updated 13 Nov 2026" (en-GB, Europe/London);
  - **Open course**, the main link, to `https://lc-elearn.github.io/<repo>/`, with an
    accessible name that includes the title ("Open Russian Basic Vocabulary");
  - **Source on GitHub**, a smaller link to the repo.
- **The template card**, apart from the courses and after them. The template's
  `course.json` holds example text ("Cambridge Spanish — Level 1"), so its card does not
  use it: it reads "Course template: the starting point every course is made from", with
  links to its home page, `exercise-showcase.html`, `ui-showcase.html` and
  `debug-sandbox.html`.
- **Footer:** "Refreshed 13 Nov 2026, 16:00" (Europe/London), so a reader knows how
  current it is.
- Semantic HTML: a `<main>`, a list of `<article>` cards, real links. No JavaScript.

### 4.4 When it refreshes

`publish.yml` runs **every hour** (`cron`, at a minute past the hour other than `:00`),
on `workflow_dispatch`, and on a push to its own `main`. Hourly instead of "when a course
publishes": a course repo cannot start another repo's workflow without a token stored in
every course, and an hourly run is free for a public repo. A new course appears within an
hour of its first publish, or at once with "Run workflow".

## 5. Kept out of search engines (P1)

- `robots.txt` at `https://lc-elearn.github.io/robots.txt` says `Disallow: /`. Robots
  rules are per host, and every course site is on that host, so one file covers them all.
- The landing page also carries `<meta name="robots" content="noindex, nofollow">`.
- This keeps the sites out of search results. It does not stop anyone with the link
  opening them; the free plan has no login. The repos are already public, so this
  exposes nothing that was not already readable.

## 6. When something goes wrong

| Case                                           | Result                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A course's build fails on `main`               | Its last site stays up; a red ✗ in its Actions tab                                         |
| A non-template build has a debug page          | `pages.yml` stops before publishing (§3.1)                                                 |
| A course's `course.json` is missing or invalid | That card is left out; the run's summary lists "skipped: <repo>: <reason>"; others publish |
| A repo has a site but no `course.json`         | Not listed (same path as above)                                                            |
| The GitHub API fails while collecting          | The run fails; the last good landing page stays up; the next hourly run tries again        |

Pages keeps the last deployment until a new one succeeds, so a failed run never leaves a
blank site.

## 7. Testing

- **Landing repo, test first** (AGENTS.md, "New code starts from a failing test"):
  `course-json.ts` (valid, missing field, wrong type), `language.ts` (known code,
  unknown code), `render.ts` (one card, the lesson-count wording, sort order, the template
  card, escaping a `<` or `"` in a title, the noindex tag), and `collect.ts` against a
  fake `fetch` (filters, skip with reason, template detection, lesson count without the
  example). Then one dry run against the real organisation before the first publish.
- **Template:** no new site code, only `pages.yml`, `src/build/debug-pages-in.ts` (+ test),
  `scripts/check-no-debug-pages.ts` and docs; the full gate still runs. The
  nested-folder browser tests already cover the addresses. After the first publish, the
  live template site is checked by hand: home, the example lesson, each debug page.

## 8. Rollout

Each step that changes something on GitHub waits for the maintainer's yes.

1. **Template:** a pull request with `pages.yml` and the doc changes. After it merges,
   switch Pages on for the template; check its site.
2. **Landing repo:** create `lc-elearn.github.io` (public), push it, switch Pages on (it
   publishes through Actions too); check it. At first it lists only the template card.
3. **Courses:** each gets `pages.yml` at its next template update, then switches Pages on
   with its owner's agreement. Russian first.

## 9. Not in this design

- Previews of pull requests (only `main` is published; that needs another host).
- Who builds each course on the card (P5; needs a token for the private `lc-hub`).
- A login or any access control (not possible on the free plan).
- Any change to how the live course is built and uploaded (`DEPLOY.md` steps 1–9).
