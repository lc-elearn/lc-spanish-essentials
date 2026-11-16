# A Credits link in the footer (E56) — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lesson whose `lo.json` sets `"credits": "<modal id>"` shows a "Credits" button at the end of the footer's © line, opening that popup; popups may hold `<h3>` headings.

**Architecture:** The manifest schema gains `credits` (checked against `modals`); the entry parser gains a `headings` option that only the modal loader turns on, producing a `heading` entry rendered as `<h3>`. `App` → `PageLayout` → `Footer` carry the id; `CreditsButton` opens it through the existing `ModalProvider`.

**Tech stack:** React 19, Zod 4, Base UI Dialog, Vitest, Playwright. Spec: [`2026-11-11-footer-credits-design.md`](../specs/2026-11-11-footer-credits-design.md).

**Branch:** `feat/e56-footer-credits` (exists; the spec is its first commit). Never push to `main`.

**Commands:** `bun run test -- <path>` runs one Vitest file (never `bun test`). The gate is in `AGENTS.md`.

---

## File map

| File                                                           | Change                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/config/ui-strings.ts`, `.test.ts`                         | new key `credits`                                                      |
| `src/lo/rich-text/rich-text-nodes.ts`                          | `HeadingEntry` in the `RichTextEntry` union; `inlineListsOf` covers it |
| `src/lo/rich-text/parse-rich-text.ts`                          | h1–h6 join `BLOCK_ONLY_TAGS`; the own-entry message names headings     |
| `src/lo/rich-text/parse-rich-text-entry.ts`, `.test.ts`        | `options.headings`; `parseHeading`                                     |
| `src/lo/rich-text/RichTextEntries.tsx`, `.test.tsx`            | render `<h3 class="rich-text-heading">`                                |
| `src/lo/rich-text/rich-text.css`                               | `.rich-text-heading`                                                   |
| `src/config/lo-schema.ts`, `.test.ts`                          | `credits` + refinement                                                 |
| `src/lo/assemble-lo.ts`, `.test.ts`                            | modals parsed with headings on; `credits` carried                      |
| `src/components/shell/CreditsButton.tsx`, `.test.tsx`          | new                                                                    |
| `src/components/shell/Footer.tsx`, `.test.tsx`                 | `credits` prop                                                         |
| `src/components/shell/footer.css`                              | button reset for `.footer-credits`                                     |
| `src/components/shell/PageLayout.tsx`, `.test.tsx`             | `credits` prop passed to `Footer`                                      |
| `src/App.tsx`                                                  | passes `lo.credits`                                                    |
| `src/lo/rich-text/modal/ModalProvider.tsx`                     | only if Task 8's phone test fails: cap height, scroll                  |
| `lo-config/lo-00-example/lo.json`, `modals/credits/modal.json` | the example                                                            |
| `src/lo/rich-text/lo-rich-text.test.ts`                        | the example's credits                                                  |
| `e2e/footer-credits.spec.ts`, `e2e/axe-open-states.spec.ts`    | browser tests                                                          |
| docs (Task 9)                                                  | spec §14 note, CONTRIBUTING, STRUCTURE, COURSE_GUIDE, llms.txt, TODO   |

---

### Task 1: the `credits` UI string

**Files:** Modify `src/config/ui-strings.ts`, `src/config/ui-strings.test.ts`

- [ ] **Step 1: failing test** — append to `ui-strings.test.ts`:

```ts
// The footer's Credits button (E56, spec 2026-11-11-footer-credits-design §5).
test('ui-strings: the footer credits label exists', () => {
  expect(resolveLabel('credits')).toBe('Credits');
});
```

- [ ] **Step 2:** `bun run test -- src/config/ui-strings.test.ts` → FAIL (TypeScript/Zod: `credits` is not a key; `resolveLabel` returns undefined).
- [ ] **Step 3:** in `UiStringsSchema` after `hideTranscript`:

```ts
  // The footer's Credits button (spec 2026-11-11-footer-credits-design §5)
  credits: z.string().min(1),
```

and in `raw` after `hideTranscript: 'Hide transcript',`: `credits: 'Credits',`

- [ ] **Step 4:** rerun → PASS.
- [ ] **Step 5:** `git add src/config/ui-strings.ts src/config/ui-strings.test.ts && git commit -m "feat: add the Credits UI string (E56)"`

### Task 2: a heading entry in the parser

**Files:** Modify `rich-text-nodes.ts`, `parse-rich-text.ts`, `parse-rich-text-entry.ts`, `parse-rich-text-entry.test.ts` (all in `src/lo/rich-text/`)

- [ ] **Step 1: failing tests** — append to `parse-rich-text-entry.test.ts`:

```ts
describe('headings (popups only, E56)', () => {
  const POPUP = { headings: true } as const;

  test('<h3> is a heading entry in a popup', () => {
    expect(parseRichTextEntry('<h3>Team <em>2026</em></h3>', undefined, POPUP)).toEqual({
      kind: 'heading',
      children: [text('Team '), { kind: 'em', children: [text('2026')] }],
    });
  });

  test('must be the whole entry', () => {
    expect(() => parseRichTextEntry('<h3>Team</h3> and more', undefined, POPUP)).toThrow(
      /must be the whole entry/,
    );
  });

  test('takes no attributes', () => {
    expect(() => parseRichTextEntry('<h3 id="t">Team</h3>', undefined, POPUP)).toThrow(
      /takes no attributes/,
    );
  });

  test('needs text', () => {
    expect(() => parseRichTextEntry('<h3>  </h3>', undefined, POPUP)).toThrow(/needs text/);
  });

  test('rejects an unclosed heading', () => {
    expect(() => parseRichTextEntry('<h3>Team', undefined, POPUP)).toThrow(/unclosed <h3>/);
  });

  test.each(['h1', 'h2', 'h4', 'h6'])('rejects <%s> in a popup, pointing at <h3>', (name) => {
    expect(() => parseRichTextEntry(`<${name}>Team</${name}>`, undefined, POPUP)).toThrow(
      /use <h3>/,
    );
  });

  test('page prose (the default) refuses any heading, saying where they belong', () => {
    expect(() => parseRichTextEntry('<h3>Team</h3>')).toThrow(
      /headings are allowed only in popups \(modal\.json\)/,
    );
  });

  test('a heading mid-paragraph gets the own-entry message', () => {
    expect(() => parseRichTextEntry('Intro <h3>Team</h3>', undefined, POPUP)).toThrow(/own entry/);
  });
});
```

- [ ] **Step 2:** `bun run test -- src/lo/rich-text/parse-rich-text-entry.test.ts` → the new tests FAIL (no third parameter; `<h3>` "is not in the rich-text allowlist").
- [ ] **Step 3: nodes** — in `rich-text-nodes.ts`, after `AudioPlayerEntry`:

```ts
/** `<h3>` inside a popup (E56): the dialog title is the h2, so this is one level below. */
export interface HeadingEntry {
  readonly kind: 'heading';
  readonly children: readonly RichTextNode[];
}

export type RichTextEntry =
  | ParagraphEntry
  | ListEntry
  | TableEntry
  | AudioPlayerEntry
  | HeadingEntry;
```

and in `inlineListsOf` change `case 'paragraph':` to `case 'paragraph':\n    case 'heading':` so links, hover terms and audio in a heading are collected.

- [ ] **Step 4: own-entry message** — in `parse-rich-text.ts` add `'h1', 'h2', 'h3', 'h4', 'h5', 'h6'` to `BLOCK_ONLY_TAGS`, and change `OWN_ENTRY` to:

```ts
const OWN_ENTRY =
  'is a block — a list, table, heading or audio player must be its own entry in the ' +
  'array, not part of a paragraph';
```

- [ ] **Step 5: the parser** — in `parse-rich-text-entry.ts`, import `RichTextNode` is already there. Add above `parseRichTextEntry`:

```ts
/** Options for `parseRichTextEntry`. */
export interface RichTextEntryOptions {
  /** Accept one `<h3>` as a whole entry. Only popups pass `true` (spec E56 §4). */
  readonly headings?: boolean;
}

const HEADING_TAG = /^h[1-6]$/;

/** True when `nodes` hold no visible text at any depth. */
function isBlank(nodes: readonly RichTextNode[]): boolean {
  return nodes.every((node) =>
    node.kind === 'text' ? node.value.trim() === '' : 'children' in node && isBlank(node.children),
  );
}

function parseHeading(
  cursor: Cursor,
  name: string,
  headings: boolean,
  source?: string,
): RichTextEntry {
  if (!headings) {
    cursor.fail(
      `<${name}>: headings are allowed only in popups (modal.json) — the page's headings ` +
        'come from its sections',
    );
  }
  if (name !== 'h3') {
    cursor.fail(
      `<${name}>: use <h3> — the popup's title is its heading, so a heading inside it is ` +
        'one level below',
    );
  }
  cursor.readBareTag();
  const children = parseRichText(cursor.readBodyUntilClose('h3'), source);
  if (isBlank(children)) cursor.fail('<h3> needs text');
  cursor.expectEnd('h3');
  return { kind: 'heading', children };
}
```

Change the signature and dispatch of `parseRichTextEntry`:

```ts
export function parseRichTextEntry(
  html: string,
  source?: string,
  options: RichTextEntryOptions = {},
): RichTextEntry {
  const fail = failWith(source);
  const start = html.length - html.trimStart().length;
  if (html[start] === '<') {
    const first = readTag(html, start, fail);
    if (!first.isClosing) {
      if (first.name === 'span' && first.attributes['data-audio-player'] !== undefined) {
        return parsePlayer(new Cursor(html, first.end, fail), first);
      }
      if (HEADING_TAG.test(first.name)) {
        return parseHeading(
          new Cursor(html, start, fail),
          first.name,
          options.headings === true,
          source,
        );
      }
      if (first.name === 'ul' || first.name === 'ol' || first.name === 'table') {
        // unchanged
      }
    }
  }
  return { kind: 'paragraph', children: parseRichText(html, source) };
}
```

Update the file header's first paragraph to list `<h3>` (popups only). `readTag` lower-cases tag names, so `<H3>` is handled as `<h3>`.

- [ ] **Step 6:** rerun → all PASS. Then `bun run test -- src/lo/rich-text` (the inline parser's own-entry test still matches `/own entry/`).
- [ ] **Step 7:** `bunx tsc -b` — `EntryView`'s switch in `RichTextEntries.tsx` is now non-exhaustive and fails type-checking; that is Task 3. Commit Tasks 2 and 3 together.

### Task 3: render the heading

**Files:** Modify `src/lo/rich-text/RichTextEntries.tsx`, `RichTextEntries.test.tsx`, `rich-text.css`

- [ ] **Step 1: failing test** — in `RichTextEntries.test.tsx` (it renders with `renderToStaticMarkup`):

```tsx
test('a heading entry renders an <h3> with its inline children (E56)', () => {
  const html = renderToStaticMarkup(
    <RichTextEntries
      entries={[{ kind: 'heading', children: [{ kind: 'text', value: 'Team' }] }]}
    />,
  );
  expect(html).toBe('<h3 class="rich-text-heading">Team</h3>');
});
```

(If the file's existing tests wrap output, match their pattern; the assertion is the `<h3 class="rich-text-heading">Team</h3>` string.)

- [ ] **Step 2:** run → FAIL (nothing rendered for `heading`).
- [ ] **Step 3:** in `EntryView`, add before `case 'list'`:

```tsx
    case 'heading':
      return (
        <h3 className="rich-text-heading">
          <RichText nodes={entry.children} />
        </h3>
      );
```

In `rich-text.css`, inside `@layer components`, after the `.rich-text-list > li + li` rule:

```css
/* A heading inside a popup (E56). The dialog title is the h2 at `text-base`; this sits
     one level below it, at the body's size, set apart by weight and the space above. */
.rich-text-heading {
  margin-top: 0.5rem;
  font-family: var(--font-heading);
  font-size: 0.875rem;
  font-weight: 600;
}
```

- [ ] **Step 4:** `bun run test -- src/lo/rich-text` → PASS; `bun run lint:css` → clean.
- [ ] **Step 5:** `git add src/lo/rich-text && git commit -m "feat: allow an <h3> heading as a popup entry (E56)"`

### Task 4: `credits` in the manifest, headings in popups

**Files:** Modify `src/config/lo-schema.ts`, `lo-schema.test.ts`, `src/lo/assemble-lo.ts`, `assemble-lo.test.ts`

- [ ] **Step 1: failing schema tests** — append to `lo-schema.test.ts` (`oneSection` is defined at its top):

```ts
// The footer's Credits link (E56): optional, and only ever a declared modal.
test('lo-schema: manifest without credits parses, leaving it undefined', () => {
  expect(LoManifestSchema.parse({ title: 'T', sections: oneSection }).credits).toBeUndefined();
});

test('lo-schema: manifest accepts credits naming a declared modal', () => {
  const parsed = LoManifestSchema.parse({
    title: 'T',
    sections: oneSection,
    modals: ['credits'],
    credits: 'credits',
  });
  expect(parsed.credits).toBe('credits');
});

test('lo-schema: manifest rejects credits naming an undeclared modal', () => {
  const result = LoManifestSchema.safeParse({
    title: 'T',
    sections: oneSection,
    modals: ['example-popup'],
    credits: 'credits',
  });
  expect(result.success).toBe(false);
  expect(result.error?.issues).toContainEqual(
    expect.objectContaining({
      path: ['credits'],
      message: 'credits names modal "credits", which modals does not declare — add it to modals',
    }),
  );
});
```

- [ ] **Step 2: failing assembly tests** — append to `assemble-lo.test.ts`:

```ts
test('assembleLo: a popup may hold an <h3>, and credits is carried through (E56)', () => {
  const tree = validTree();
  const lo = assembleLo('lo-01-salutations', {
    ...tree,
    manifest: { ...tree.manifest, modals: ['credits'], credits: 'credits' },
    modals: { credits: { title: 'Credits', content: ['Made by us.', '<h3>Team</h3>'] } },
  });
  expect(lo.credits).toBe('credits');
  expect(lo.modals.credits.content[1]).toEqual({
    kind: 'heading',
    children: [{ kind: 'text', value: 'Team' }],
  });
});

test('assembleLo: omits credits entirely when the manifest declares none', () => {
  expect('credits' in assembleLo('lo-01-salutations', validTree())).toBe(false);
});
```

- [ ] **Step 3:** `bun run test -- src/config/lo-schema.test.ts src/lo/assemble-lo.test.ts` → FAIL.
- [ ] **Step 4:** in `LoManifestSchema` after `hovers`:

```ts
    /**
     * The modal the footer's Credits button opens (E56). Optional: absent, the footer
     * has no Credits button. Must be one of `modals`, checked below.
     */
    credits: z
      .string()
      .regex(SECTION_ID_PATTERN, 'credits must be a modal id (url-safe kebab-case)')
      .optional(),
```

and at the end of the `superRefine`:

```ts
if (manifest.credits !== undefined && !manifest.modals.includes(manifest.credits)) {
  ctx.addIssue({
    code: 'custom',
    message: `credits names modal "${manifest.credits}", which modals does not declare — add it to modals`,
    path: ['credits'],
  });
}
```

In `assemble-lo.ts`: add to `AssembledLo` after `hovers`:

```ts
  /** The modal id the footer's Credits button opens; absent when lo.json sets none (E56). */
  readonly credits?: string;
```

change the modal parse to `parseRichTextEntry(entry, filePath, { headings: true })` with a comment `// Popups only may hold an <h3> (E56).`, and in the returned object after `hovers,` add `...(manifest.credits === undefined ? {} : { credits: manifest.credits }),`.

- [ ] **Step 5:** rerun → PASS; `bun run test -- src/lo src/config` → PASS.
- [ ] **Step 6:** `git add src/config/lo-schema.ts src/config/lo-schema.test.ts src/lo/assemble-lo.ts src/lo/assemble-lo.test.ts && git commit -m "feat: name a lesson's credits popup in lo.json (E56)"`

### Task 5: `CreditsButton`

**Files:** Create `src/components/shell/CreditsButton.tsx`, `CreditsButton.test.tsx`

- [ ] **Step 1: failing test** — `CreditsButton.test.tsx`. The repo has no Testing Library; interactive tests mount with `createRoot` + `act` on happy-dom (`src/components/audio/SequenceAudioController.test.tsx`). The context is stubbed, so the test is about the button; the real dialog is Task 8's browser test.

```tsx
// @vitest-environment happy-dom
/**
 * CreditsButton (E56): the footer's "Credits" asks the page's one ModalProvider to open
 * the lesson's credits popup. Spec: docs/specs/2026-11-11-footer-credits-design.md §5.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ModalContext, type ModalContextValue } from '@/lo/rich-text/modal/modal-context';
import CreditsButton from './CreditsButton';

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(open: (id: string) => void): HTMLButtonElement {
  const value: ModalContextValue = { modals: {}, openId: null, open, close: vi.fn() };
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <ModalContext.Provider value={value}>
        <CreditsButton modalId="credits" />
      </ModalContext.Provider>,
    ),
  );
  const button = container.querySelector('button');
  if (button === null) throw new Error('no button rendered');
  return button;
}

describe('CreditsButton', () => {
  test('is a plain button labelled "Credits" from ui-strings', () => {
    const button = mount(vi.fn());
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent).toBe('Credits');
  });

  test('a click opens the named popup', () => {
    const open = vi.fn();
    act(() => mount(open).click());
    expect(open).toHaveBeenCalledWith('credits');
  });

  test('outside a ModalProvider it fails loudly, as a popup link does', () => {
    expect(() => renderToStaticMarkup(<CreditsButton modalId="credits" />)).toThrow(
      /ModalProvider/,
    );
  });
});
```

- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3:** `CreditsButton.tsx`:

```tsx
/**
 * CreditsButton — the footer's "Credits" (E56). A <button>, not a link: it opens the
 * lesson's credits popup and navigates nowhere (rich-text spec §7, as ModalLink).
 * Styled as the footer's licence link (`.footer-licence-link`), with the button chrome
 * reset by `.footer-credits` in footer.css. Spec: 2026-11-11-footer-credits-design §5.
 */
import { resolveLabel } from '@/config/ui-strings';
import { useModal } from '@/lo/rich-text/modal/modal-context';

interface CreditsButtonProps {
  /** The declared modal to open — `lo.json`'s `credits`. */
  modalId: string;
}

export default function CreditsButton({ modalId }: CreditsButtonProps) {
  const { open } = useModal();
  return (
    <button
      type="button"
      className="footer-licence-link footer-credits"
      onClick={() => open(modalId)}
    >
      {resolveLabel('credits')}
    </button>
  );
}
```

- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit with Task 6.

### Task 6: `Footer`, `PageLayout`, `App`

**Files:** Modify `Footer.tsx`, `Footer.test.tsx`, `footer.css`, `PageLayout.tsx`, `PageLayout.test.tsx` (in `src/components/shell/`), `src/App.tsx`

- [ ] **Step 1: failing Footer tests** — in `Footer.test.tsx` add `import { ModalProvider } from '@/lo/rich-text/modal/ModalProvider';` and `vi` to the vitest import, then:

```tsx
describe('Footer credits (E56)', () => {
  const MODALS = { credits: { id: 'credits', title: 'Credits', content: [] } };
  const withCredits = () =>
    renderToStaticMarkup(
      <ModalProvider modals={MODALS}>
        <Footer credits="credits" />
      </ModalProvider>,
    );

  test('without credits there is no Credits button', () => {
    expect(renderToStaticMarkup(<Footer />)).not.toMatch(/Credits/);
  });

  test('with credits, the © line ends with a hidden separator and the button', () => {
    expect(withCredits()).toMatch(
      /<p class="footer-copyright">© .*University of Cambridge<span aria-hidden="true"> · <\/span><button type="button" class="footer-licence-link footer-credits">Credits<\/button><\/p>/,
    );
  });

  test('the footer still holds no heading and no dead link', () => {
    const html = withCredits();
    expect(html).not.toMatch(/<h[1-6][\s/>]/);
    expect(html).not.toMatch(/href="#/);
  });

  test('with no © holder the line holds the button alone', async () => {
    vi.resetModules();
    vi.doMock('@/config/footer.config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/config/footer.config')>();
      return { footerConfig: { ...actual.footerConfig, copyrightHolder: undefined } };
    });
    const { default: BareFooter } = await import('./Footer');
    const { ModalProvider: Provider } = await import('@/lo/rich-text/modal/ModalProvider');
    const html = renderToStaticMarkup(
      <Provider modals={MODALS}>
        <BareFooter credits="credits" />
      </Provider>,
    );
    vi.doUnmock('@/config/footer.config');
    expect(html).toMatch(
      /<p class="footer-copyright"><button type="button" class="footer-licence-link footer-credits">Credits<\/button><\/p>/,
    );
  });
});
```

The exact © markup between `©` and the holder comes from the existing Footer (`<!-- -->` comments may appear in static markup around the year span); if the regex trips on them, loosen `.*` only, never the part after the holder.

- [ ] **Step 2: failing PageLayout test** — in `PageLayout.test.tsx`:

```tsx
test('passes credits to the footer (E56)', () => {
  const html = renderToStaticMarkup(
    <ModalProvider modals={{ credits: { id: 'credits', title: 'Credits', content: [] } }}>
      <PageLayout title="Lesson" sections={sections} credits="credits" />
    </ModalProvider>,
  );
  expect(html).toContain('class="footer-licence-link footer-credits">Credits</button>');
});
```

(import `ModalProvider` from `@/lo/rich-text/modal/ModalProvider`).

- [ ] **Step 3:** `bun run test -- src/components/shell` → the new tests FAIL.
- [ ] **Step 4: Footer** — import `CreditsButton`; take `{ credits }: FooterProps` with

```tsx
interface FooterProps {
  /** The modal the © line's Credits button opens; absent → no button (E56). */
  credits?: string;
}
```

and replace the copyright block with:

```tsx
{
  copyrightHolder === undefined && credits === undefined ? null : (
    <p className="footer-copyright">
      {copyrightHolder === undefined ? null : (
        <>
          {/* existing year comment, unchanged */}
          <>© </>
          <span suppressHydrationWarning>{new Date().getFullYear()}</span> {copyrightHolder}
        </>
      )}
      {credits === undefined ? null : (
        <>
          {copyrightHolder === undefined ? null : <span aria-hidden="true"> · </span>}
          <CreditsButton modalId={credits} />
        </>
      )}
    </p>
  );
}
```

Add a sentence to the file header: the © line may end with a Credits button (E56), the one piece of the footer that comes from the lesson, not `footer.config.ts`.

- [ ] **Step 5: CSS** — in `footer.css`, after the `.footer-licence-link:focus-visible` rule:

```css
/* The Credits button (E56) wears the licence link's look; these reset the button's
     own chrome so it reads as the link beside the © text. */
.footer-credits {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
```

`.footer-licence-link` already carries colour, underline, hover, focus and the reduced-motion `transition: none`.

- [ ] **Step 6: PageLayout** — add to `PageLayoutProps`:

```ts
  /** The lesson's credits popup id, for the footer's Credits button (E56). */
  credits?: string;
```

destructure it, and render `<Footer credits={credits} />`.

- [ ] **Step 7: App** — add `credits={lo.credits}` to `<PageLayout …>`.
- [ ] **Step 8:** `bun run test -- src/components/shell src/guards` → PASS (guard h renders every LO through `App`; still green because the example sets no credits yet).
- [ ] **Step 9:** `git add src/components/shell src/App.tsx && git commit -m "feat: show a lesson's Credits button in the footer (E56)"`

### Task 7: the example lesson

**Files:** Create `lo-config/lo-00-example/modals/credits/modal.json`; modify `lo-config/lo-00-example/lo.json`, `src/lo/rich-text/lo-rich-text.test.ts`

- [ ] **Step 1: failing test** — in `lo-rich-text.test.ts`, inside `describe('the example LO specifically'`:

```ts
// E56: the example is the authoring reference for credits, so a copied lesson starts
// with a popup in the 2015 shape — paragraph, Team heading, role lines, Voices list.
test('names a credits popup holding a heading and a list', () => {
  const lo = loadLo('lo-00-example');
  expect(lo.credits).toBe('credits');
  const kinds = lo.modals.credits.content.map((entry) => entry.kind);
  expect(kinds).toContain('heading');
  expect(kinds).toContain('list');
  expect(lo.modals.credits.title).toBe('Credits');
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** `modals/credits/modal.json`:

```json
{
  "title": "Credits",
  "content": [
    "<strong>Example Learning Object</strong> is a placeholder lesson. Replace this line with who developed the lesson and for which course.",
    "<h3>Team</h3>",
    "<strong>Content:</strong> Placeholder name",
    "<strong>Audio and video recordings:</strong> Placeholder name",
    "<strong>Voices:</strong>",
    "<ul><li>Placeholder voice one</li><li>Placeholder voice two</li></ul>",
    "<strong>Illustration:</strong> Placeholder name",
    "<strong>Implementation:</strong> Placeholder name",
    "<strong>Concept:</strong> Placeholder name",
    "This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International Licence.",
    "© University of Cambridge"
  ]
}
```

In `lo.json`: `"modals": ["example-popup", "conjugation", "credits"],` and add `"credits": "credits"` after `"hovers"`.

- [ ] **Step 4:** `bun run test -- src/lo src/guards` → PASS (guard h now renders the example with the button; guard b/d unaffected: no new asset).
- [ ] **Step 5:** `git add lo-config/lo-00-example src/lo/rich-text/lo-rich-text.test.ts && git commit -m "feat: give the example lesson a credits popup (E56)"`

### Task 8: browser tests

**Files:** Create `e2e/footer-credits.spec.ts`; modify `e2e/axe-open-states.spec.ts`; maybe `src/lo/rich-text/modal/ModalProvider.tsx`

- [ ] **Step 1: tests** — `e2e/footer-credits.spec.ts`:

```ts
/**
 * footer-credits.spec.ts — the footer's Credits button on the example lesson (E56,
 * docs/specs/2026-11-11-footer-credits-design.md §5, §7).
 */
import { expect, test } from '@playwright/test';

import { animationsInside, exampleReady } from './support';

test('Credits opens the credits popup, and Escape returns focus to it', async ({ page }) => {
  await page.goto('example.html');
  await exampleReady(page);
  const button = page.getByRole('contentinfo').getByRole('button', { name: 'Credits' });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Credits' });
  await expect(dialog).toBeVisible();
  await animationsInside(dialog);
  await expect(dialog.getByRole('heading', { level: 3, name: 'Team' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('on a phone the whole popup can be read', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('example.html');
  await exampleReady(page);
  await page.getByRole('contentinfo').getByRole('button', { name: 'Credits' }).click();
  const dialog = page.getByRole('dialog', { name: 'Credits' });
  await animationsInside(dialog);
  const box = await dialog.boundingBox();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(568);
  const last = dialog.getByText('© University of Cambridge');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test('the landing page has no Credits button', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.getByRole('contentinfo').getByRole('button', { name: 'Credits' })).toHaveCount(
    0,
  );
});
```

Note: on a `home: "lesson"` build `index.html` is the lesson; read `course.json`'s `home` as `e2e/home-page.spec.ts` does and `test.skip` the landing test when it is `"lesson"`.

In `axe-open-states.spec.ts` `OPEN_STATES`, after the conjugation entry:

```ts
  {
    name: 'the credits popup open',
    open: async (page) => {
      await page.getByRole('contentinfo').getByRole('button', { name: 'Credits' }).click();
      const dialog = page.getByRole('dialog', { name: 'Credits' });
      await expect(dialog).toBeVisible();
      await animationsInside(dialog);
    },
  },
```

- [ ] **Step 2:** `bun run build && bun run test:e2e -- e2e/footer-credits.spec.ts e2e/axe-open-states.spec.ts`. Expected: the first and third pass; the phone test **fails** if the dialog overflows (the popup has no height cap today).
- [ ] **Step 3: only if the phone test failed** — in `ModalProvider.tsx` give `DialogContent` `className="max-h-[calc(100dvh-2rem)] overflow-y-auto"` (rem in a calc, allowed by guard f), with a comment: a long popup (credits) must scroll inside the viewport. Rebuild and rerun; then run the whole axe file again, since a scroll container must stay keyboard-reachable (axe `scrollable-region-focusable`; Base UI's popup takes focus, so it should pass — if axe flags it, add `tabIndex={-1}` is NOT enough; report rather than suppress).
- [ ] **Step 4:** all pass in Chromium, Firefox and WebKit.
- [ ] **Step 5:** `git add e2e src/lo/rich-text/modal && git commit -m "test: browser checks for the footer's Credits popup (E56)"`

### Task 9: docs

**Files:** `docs/specs/lo-rich-text-modals.md`, `docs/specs/2026-11-11-footer-credits-design.md`, `CONTRIBUTING.md`, `STRUCTURE.md`, `COURSE_GUIDE.md`, `public/llms.txt`, `docs/process/TODO.md`. Re-read each right before editing (Prettier reflows tables).

- [ ] **Step 1:** rich-text spec, end of §14 "Authoring": `_(Amended 2026-11-11, E56: a popup may also hold one `<h3>` as a whole entry; page prose may not. The one exception to "anything a popup accepts, page prose accepts" — [`2026-11-11-footer-credits-design.md`](../specs/2026-11-11-footer-credits-design.md) §4.)_`
- [ ] **Step 2:** CONTRIBUTING, after the rich-text paragraph (line ~129): a short "Credits" paragraph — set `"credits": "<modal id>"` in `lo.json` to add a Credits button to the lesson's footer; the popup is an ordinary one, and popups (only) may use `<h3>` for a heading such as "Team"; link the E56 spec.
- [ ] **Step 3:** STRUCTURE's tree: add `modals/credits/modal.json         the footer's Credits popup, named by lo.json's credits` under the example-popup line.
- [ ] **Step 4:** COURSE_GUIDE: where lessons' files are described, one line that the footer's Credits link is per lesson (`credits` in `lo.json`), linking CONTRIBUTING.
- [ ] **Step 5:** `public/llms.txt`, Notes: `- A lesson may end its footer's © line with a "Credits" button that opens a popup (a dialog) naming the lesson's team; it navigates nowhere.`
- [ ] **Step 6:** E56 spec header: `**Status:** built 2026-11-11 (TODO §E56)`; add a "Deviations" note only if Task 8 Step 3 ran (the height cap applies to every popup).
- [ ] **Step 7:** TODO: an **E56** entry after E55 in the same shape (what, spec and plan links, verify line, next: courses take it with their next update; the Russian course sets `credits` per lesson); a "Done recently" row; update the suite counts in the header from the gate's output.
- [ ] **Step 8:** `bun run format` then commit `docs: record the footer's Credits link (E56)`.

### Task 10: gate and pull request

- [ ] **Step 1:** `bun run format && bun run lint && bun run lint:css && bun run test:coverage && bun run build && bun run test:e2e` — all green. Note the counts.
- [ ] **Step 2:** `DEBUG=1 bun run build && DEBUG=1 bun run test:e2e` — green.
- [ ] **Step 3:** base-path checks (hard constraint 3): `bun run build && SERVE_PATH=/any/folder/ bun run test:e2e -- e2e/footer-credits.spec.ts`.
- [ ] **Step 4:** measure gzipped `main-*.js` and `main-*.css` against `docs/TOOLING.md` "Bundle budget".
- [ ] **Step 5:** the `before-pr` skill, then push the branch and open the pull request (title `feat: a per-lesson Credits link in the footer (E56)`), merge with **Rebase and merge** once CI is green, after the maintainer's go-ahead.
