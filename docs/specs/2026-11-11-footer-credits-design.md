# A Credits link in the footer (E56)

**Date:** 2026-11-11 · **Status:** built 2026-11-11 (TODO §E56) · **Plan:** [`2026-11-11-footer-credits-plan.md`](../process/2026-11-11-footer-credits-plan.md)
**TODO:** §E56 · **Builds on:** [`lo-rich-text-modals.md`](lo-rich-text-modals.md) (popups),
[`2026-09-09-footer-colophon-design.md`](2026-09-09-footer-colophon-design.md) (the footer)

> **Deviations from this spec.** (1) §7: `CreditsButton.test.tsx` stubs the modal
> context and checks the click asks for `"credits"`; the real dialog is the browser test.
> (2) §7: the browser test opens the popup from the keyboard before checking that Escape
> returns focus: WebKit, like Safari, does not focus a button on a mouse click, so a click
> leaves no focus to return. (3) The plan's phone check (320 × 568) passed with no change,
> so popups keep their height. (4) Guard b's own test lists the example's modal folders,
> so it gained `credits`; the guard itself is unchanged. (5) §5: the button's classes are
> `footer-licence-link footer-credits`; the button's own chrome is reset by a separate
> `.footer-credits` rule in `footer.css`, inside the same `@layer components`, not in the
> licence link's rule. (Recorded 2026-11-11, after the docs review.)

## 1. Why

The 2015 Russian lessons end their footer's © line with a link, "Credits.". It opens a
popup titled "Credits": a paragraph naming the lesson and who developed it, a "Team"
heading, role lines ("Content: …", "Audio/Video Recordings: …", "Voices:" with a
bulleted list of names, "Illustration: …", "Implementation: …", "Concept: …"), then the
licence and copyright lines. The team differs per lesson. The Russian course is the first
user.

`src/config/footer.config.ts` is the institution's footer, the same in every course, so
credits do not belong there.

## 2. Decisions (maintainer, 2026-11-11)

| #   | Decision                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Per lesson only.** An optional `credits` key in `lo.json` names one of that lesson's declared `modals`. No course-wide default: the landing page has no popup provider, and no course has asked for one. A one-lesson course (`"home": "lesson"`, E55) shows it on `index.html`. |
| C2  | **`<h3>` in popups only.** A popup entry may be one `<h3>` heading. Page prose, tabs and transcripts still refuse it. This is a written exception to rich-text spec §14's "anything a popup accepts, page prose accepts" (§4).                                                     |
| C3  | **At the end of the © line**: `© 2026 University of Cambridge · Credits`, styled like the licence link.                                                                                                                                                                            |
| C4  | **Shown in the example lesson**, as the tabs-media work did. A lesson copied from the example starts with a credits popup to fill in or delete.                                                                                                                                    |

## 3. Config

```json
{
  "title": "…",
  "sections": [ … ],
  "modals": ["example-popup", "credits"],
  "credits": "credits"
}
```

- `credits` is optional. Absent, the footer is unchanged.
- It must be a modal id in the same `lo.json`'s `modals`. Otherwise the load fails at
  `lo.json` → `credits` with: `credits names modal "<id>", which modals does not declare —
add it to modals`. The id pattern is the modal id's (url-safe kebab-case).
- The popup is an ordinary `modals/<id>/modal.json` (`title`, `content`, optional
  `lang`). Nothing about it is credits-specific, so the dialog's title is whatever the
  author writes, normally "Credits".

## 4. A heading inside a popup

```json
{
  "title": "Credits",
  "content": [
    "This lesson was developed by …",
    "<h3>Team</h3>",
    "<strong>Content:</strong> …",
    "<strong>Voices:</strong>",
    "<ul><li>…</li><li>…</li></ul>",
    "© 2026 University of Cambridge"
  ]
}
```

- `parseRichTextEntry(html, source, options)` gains `options.headings` (default
  `false`). Only the modal loader in `src/lo/assemble-lo.ts` passes `true`.
- With headings on, an entry starting with `<h3>` is a heading block: the whole entry
  (text after `</h3>` fails, as for a list), no attributes, a body that `parseRichText`
  accepts and that is not blank. New node: `{ kind: 'heading'; children: RichTextNode[] }`.
  `RichTextEntries` renders `<h3>`.
- `<h1>`, `<h2>`, `<h4>`–`<h6>` fail in a popup: `use <h3> — the popup's title is its
heading, so a heading inside it is one level below`.
- With headings off (page prose, tabs, transcripts), any `<h1>`–`<h6>` fails:
  `headings are allowed only in popups (modal.json) — the page's headings come from
its sections`. Today such a tag already fails as an unknown tag; this only makes the
  message say why.
- **Why only `<h3>`.** Base UI's `Dialog.Title` renders an `<h2>`, so the dialog's own
  outline is h2 → h3. The page outline is untouched: the dialog lives in a portal and is
  `aria-modal`, so while it is open the page behind it is out of reach.
- Hover cards are unaffected: they take inline rich text only.

## 5. Rendering

- `App` passes `lo.credits` to `PageLayout` as `credits`, which passes it to `Footer`.
  `CourseHome` (the landing page) passes nothing.
- `Footer` renders the © paragraph when there is a `copyrightHolder` **or** a
  `credits` id. After the holder it renders `<span aria-hidden="true"> · </span>` and
  then `CreditsButton`; with no holder, the paragraph holds the button alone.
- `CreditsButton` (`src/components/shell/CreditsButton.tsx`) is a
  `<button type="button" className="footer-licence-link">` whose text is the new
  ui-strings key `credits` ("Credits"), and whose click calls `useModal().open(id)`.
  Outside a `ModalProvider` `useModal` throws, as `ModalLink` does: only `App` passes an
  id, and `App` wraps the page in the provider.
- **Look.** The licence link's own rule: footer text colour, semibold, underlined from
  the font's metric, `--primary` on hover, the 2px `--ring` focus outline, no transition
  under reduced motion. A `<button>` needs its UA chrome removed (background, border,
  padding, font) in the same `@layer components` rule. No new tokens; both themes come
  from the footer's existing ones.
- **Popup.** The existing single dialog: focus trap, Escape, focus back to the Credits
  button, the ✕ close button. The 2015 popup's bottom "Close" button is not added, so
  every popup in a course closes the same way.
- **Prerender.** The button is static markup and the provider starts closed, so the
  prerender equals the first client render (hard constraint 4).

## 6. Example lesson

`lo-config/lo-00-example/modals/credits/modal.json`, placeholder content in the shape of
§4 (a paragraph, the Team heading, six role lines with Voices as a list, the licence and
copyright lines), declared in `modals` and named by `"credits": "credits"`.

## 7. Tests (each written first, seen failing)

| Where                                            | What                                                                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/lo-schema.test.ts`                   | `credits` absent passes; a declared id passes; an undeclared id fails with the §3 message at `credits`                                         |
| `src/lo/rich-text/parse-rich-text-entry.test.ts` | heading on: `<h3>` parses; trailing text, attributes, blank body, `<h2>`, `<h4>` fail; heading off: `<h3>` fails with the popup-only message   |
| `src/lo/assemble-lo.test.ts`                     | a modal with `<h3>` assembles; `credits` reaches `AssembledLo`                                                                                 |
| `src/lo/rich-text/RichTextEntries.test.tsx`      | a heading entry renders `<h3>` with its inline children                                                                                        |
| `src/components/shell/Footer.test.tsx`           | no `credits`: markup unchanged; with `credits`: a "Credits" button after the holder, the dot hidden; no holder: the button alone               |
| `src/components/shell/CreditsButton.test.tsx`    | clicking opens the named modal inside a `ModalProvider`                                                                                        |
| `src/config/ui-strings.test.ts`                  | `credits` is a required key                                                                                                                    |
| `src/lo/load-lo.test.ts`                         | the example declares `credits` and it resolves                                                                                                 |
| `e2e/footer-credits.spec.ts`                     | on the example page, Credits opens a dialog named "Credits" holding a level-3 "Team" heading; Escape closes it and focus returns to the button |
| `e2e/axe-open-states.spec.ts`                    | a new state, the credits popup open, passes axe (the file's existing light and dark runs)                                                      |

## 8. Docs

`public/llms.txt` (the lesson format), `CONTRIBUTING.md` (the popups section: `credits`
and the heading), `COURSE_GUIDE.md` and `STRUCTURE.md` where they describe `lo.json` or
`modals/`, linking rather than restating; a dated amendment under rich-text spec §14
pointing here; TODO §E56 when done.

## 9. Out of scope

- A course-wide default (C1). Wake-up trigger: a course asks for one credits popup on
  every lesson or on the landing page.
- A bottom Close button in popups (§5).
- Headings in page prose, or levels other than h3 in popups.
