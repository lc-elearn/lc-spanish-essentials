# One word bank per lesson, shown by topic and A–Z (E63)

**Date:** 2026-11-12 · **Status:** built and merged 2026-11-12 (TODO §E63, PR 115, `0d0a8f3`; fix PR 116, `7a15d2f`) · **Plan:** [`2026-11-12-vocabulary-word-bank-plan.md`](../process/2026-11-12-vocabulary-word-bank-plan.md)
**TODO:** §E63 · **Answers:** template issue 108 (Russian, vocabulary block) ·
**Builds on:** `src/lo/blocks/VocabularyBlock.tsx`, E62's `src/audio/row-clip.ts`
([`2026-11-12-row-click-audio-design.md`](2026-11-12-row-click-audio-design.md)), which
merged first (PR 114)

## 1. Why

The Russian course is being moved from the 2015 LC Online units onto this template. The
goal (maintainer, 2026-11-12) is to **keep the 2015 teaching approach, not the 2015
layout**: the layout is modernised by the template; what the units teach must not break.

Issue 108 asks for three options that would rebuild the 2015 page as it was: turn the
sort buttons off, Hide Russian / Hide English buttons, and letter headings. Looking at the
2015 units (unit 1 "Family and Marriage", 3, 5 and 7, from the maintainer's zips) shows
what the page actually teaches:

| 2015 Russian                                                    | The general idea                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| "Vocabulary organised alphabetically": single headwords, A–Z    | A glossary: headwords in the language's order, under letters |
| "Vocabulary organised semantically": words and phrases by topic | Topic groups: the same words and their phrases, by meaning   |
| Hide Russian / Hide English; click a hidden cell to reveal it   | Self-test: cover one side, recall, reveal word by word       |

The two 2015 lists are **related, not the same list sorted twice**. In unit 1, 39 entries
are in both, 24 only in the A–Z list (headwords such as _гражданский_, _кругозор_) and 16
only in the topic list (phrases such as _гражданский брак_, _они не могут жить друг без
друга_), counting a match after ignoring stress, spacing, bracketed grammar notes and
Latin look-alike letters; units 3, 5 and 7 share 85–95%. Every shared word was typed and
recorded twice (unit 1: of the 33 entries identical in both lists, all 33 have two
different recordings, none a copied file), and the two copies have
drifted (`(+ inst)` / `(+ instr)`, a Latin `c` in `бороться (c + inst)`). The 2015 topic
list had nine groups with no names, separated only by a rule; the course repo has since
flattened them into one list.

French (`french-lo-1`) is the simple case: one list per lesson, re-sorted in the browser,
which is what the vocabulary block does today.

## 2. Decisions (maintainer, 2026-11-12)

| #   | Decision                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | **One word bank per lesson**, shown two ways. Every word or phrase is written once (text, gloss, one recording); each entry says which view(s) it belongs to.                                      |
| W2  | **Extend the `vocabulary` block**, not a new block type: one component, one set of tests.                                                                                                          |
| W3  | **Everything new is off by default.** A block with only `items`, as every course has today, renders exactly as now. No course changes until it opts in.                                            |
| W4  | **Pedagogy, not layout.** The two 2015 accordion panels become two view buttons inside one block; issue 108's `sort: false` is not built.                                                          |
| W5  | **One recording per word.** Where a word was recorded for both 2015 lists, the topic (semantic) list's recording is kept by default; the course team may swap any.                                 |
| W6  | **Letter headings are centred, with a thin rule either side**, and come from the language's own collation, never from "first character, uppercased".                                               |
| W7  | **Self-test is either/or**: hiding one side shows the other. No audio-only mode for now.                                                                                                           |
| W8  | **A row click plays its clip through E62's helper**, and does nothing while any word in the block is hidden, so a click never both plays and reveals.                                              |
| W9  | **Russian lesson 1 ("Marriage and family") is the one worked example.** Richard, the course's author, converts lessons 2–4 from it. No conversion script in the template.                          |
| W10 | **View button labels default to "Semantic" and "Alphabetical"**, as today, so existing courses see no change; a course or block renames them through `ui-strings` / the block's `labels` override. |

## 3. Config

The block envelope (`BlockConfigSchema`, `src/config/lo-schema.ts`) gains an optional
`options` object, checked per block type as exercises' options are; today only exercises
have one. For `vocabulary`:

```json
{
  "type": "vocabulary",
  "title": "Vocabulary",
  "options": { "selfTest": true, "letterHeadings": true },
  "content": {
    "topics": [
      { "id": "marriage", "heading": "Marriage" },
      { "id": "attitudes", "heading": "Attitudes to marriage" }
    ],
    "items": [
      { "term": "брак", "gloss": "marriage", "audio": "…", "topic": "marriage" },
      {
        "term": "гражда́нский брак",
        "gloss": "civil partnership",
        "audio": "…",
        "topic": "marriage",
        "only": "topics"
      },
      { "term": "гражда́нский", "gloss": "civil", "audio": "…", "only": "alphabetical" }
    ]
  }
}
```

- `items[].topic` (optional): the `id` of a declared topic.
- `items[].only` (optional): `"topics"` or `"alphabetical"`. Absent means both views.
- `topics` (optional): the groups, in display order. `heading` is optional; a group
  without one renders as a divider.
- `options.selfTest`, `options.letterHeadings`: booleans, default `false`.

**The build fails on** (each a Zod refine with a message naming the entry):

1. a `topic` not declared in `topics`;
2. `topics` declared and an entry that appears in the topic view (no `only`, or
   `"only": "topics"`) with no `topic`;
3. a declared topic no entry uses;
4. `topic` together with `"only": "alphabetical"` (the topic would never show);
5. the same `term` twice in one block (W1; compared after Unicode normalisation);
6. an unknown key in `options`, or an `only` value other than the two above.

## 4. Views

**Choosing a view.** The existing two buttons, labels per W10, `aria-pressed`, in a group
named "Choose a view". The topic (semantic) view is shown first: it is the authored order,
so the prerendered markup equals the first client render. A second press of the A–Z button
reverses the order, as today; letter headings reverse with it. If one view would be empty
(every entry has the same `only`), the buttons are not rendered and that view shows.

**Topic view.** With `topics`: one section per topic in `topics` order, an `<h4>` heading
(or a divider when the topic has none), its entries in written order. Without `topics`:
today's flat list in written order, unchanged.

**A–Z view.** The entries not marked `"only": "topics"`, sorted by
`Intl.Collator(TARGET_LANG, { sensitivity: 'base' })`, which ignores combining stress
marks. With `letterHeadings`, a new section starts wherever an entry's first letter
compares unequal (base sensitivity, course language) to the previous entry's. The heading
shows that letter with stress marks removed, upper-cased for the course language. The
heading is an `<h4>`, centred, with a thin rule either side drawn in CSS and not
announced. Which letters merge (Russian ё/е, й/и; French é/e; Spanish ñ/n; German ä/a) is
the collator's decision, pinned by tests (§8).

Each topic or letter section is its own `<dl>`.

## 5. Self-test (`options.selfTest`)

- Two toggle buttons in a group named "Test yourself": **Hide {language}** and
  **Hide English**. `{language}` is the course language's English name from
  `Intl.DisplayNames`, the same way `FlashcardsExercise` names it today; that lookup moves
  to `src/lib/lang.ts` so both share it. The labels are new `ui-strings` keys.
- The buttons are either/or (W7): pressing one releases the other. Their names never
  change; only `aria-pressed` does.
- A hidden word is **removed from the DOM**, not hidden with CSS, so assistive technology
  cannot read it early. Its cell keeps its space and holds a **Reveal** button named for its
  slot ("Reveal Russian, word 3"). Revealing moves focus to the revealed word, which
  carries `lang`, so a screen reader reads it in the course language.
- While the target-language side of an entry is hidden, its speaker's name is
  "Listen: word 3", not "Listen: брак". The speaker stays visible and working.
- Switching view keeps the hide setting and clears what was revealed. Releasing the
  pressed hide button shows everything.
- The state lives in one pure reducer (`vocabulary-self-test.ts`); the component holds
  only `useReducer`. Initial state: nothing hidden, so prerender is unchanged.
- No animation: showing and hiding are instant.

## 6. Accessibility

Covered in §4–§5. In short: real buttons with `aria-pressed` and fixed names, labelled
groups, hidden answers not in the DOM, focus moved on reveal, neutral speaker names while
hidden, real headings for topics and letters, `lang` on target-language text only, colour
from tokens only, nothing past the right edge at 320px (the gloss stacks under the term,
as today). The row click stays a pointer-only convenience (E62); the speaker is the
keyboard path.

## 7. The worked example: Russian lesson 1

Prepared once the template change has reached the Russian course through a template
update; delivered as a branch on `lc-russian-basic-vocabulary` for Richard to open the
pull request, as template updates are. The maintainer reviews it.

- **One block** replaces lesson 1's `03-vocabulary` (topic list, 55 entries) and
  `03b-vocabulary-alphabetic` (A–Z list, 63 entries).
- **Entries matched** across the two lists ignoring stress, case, spacing and Latin
  look-alike letters. A match becomes one entry with no `only`; the rest get
  `"only": "topics"` or `"only": "alphabetical"`.
- **Near-duplicates are decided by a person, not by a rule**, and listed in the branch's
  pull request: e.g. _мать-одиночка_ (A–Z) against _мать-одиночка / отец-одиночка_
  (topics); `(+ inst)` against `(+ instr)`.
- **One recording per shared word**, the topic list's (W5). The A–Z recordings no longer
  used are deleted in the same branch.
- **The nine topic groups** are recovered from the 2015 unit 1 page (`unit1.zip`); their
  headings are placeholders for the maintainer or Richard to name.
- **A short how-to for Richard** goes in the pull request: how the two lists map onto
  `topic` and `only`, how a near-duplicate was decided, which recording was kept. Lessons
  2–4 follow it; whether he needs a conversion script is his course's choice.

## 8. Tests (each written first, seen failing)

- **Schema** (`vocabulary-block-schema.test.ts`): every rule in §3, failing and passing.
- **Views** (`vocabulary-views.test.ts`, pure): which entries each view shows; topic
  order and written order inside a topic; A–Z order; reverse; a view with no entries.
- **Letters** (`vocabulary-letters.test.ts`, pure), per language: `ru` (stress ignored,
  _безнра́вственный_ under Б; ё and й pinned), `fr` (é under E), `es` (ñ its own letter,
  after N), `de` (ä under A).
- **Self-test reducer** (`vocabulary-self-test.test.ts`): hide, either/or, reveal, switch
  view, release.
- **View** (`VocabularyBlock.test.tsx`, static, and a `happy-dom` file): first render is the
  topic view with nothing hidden; `<h4>` headings; the rule is decorative; Hide/Reveal
  names; focus on reveal; the neutral speaker name; no row click while hidden; the
  "Hide Russian" label comes from the course language.
- **Example lesson**: `lo-config/lo-00-example/blocks/02-vocabulary/` gains topics,
  `selfTest` and `letterHeadings`, as the credits work showed its feature there.
- **Browser** (`e2e/`): the drill from the keyboard on the example lesson (hide, reveal,
  focus, switch view), and axe with words hidden, in both views.

## 9. Docs

- `CONTRIBUTING.md` / the `add-lo` skill: how to write a word bank (`topics`, `only`,
  `options`), linking here.
- `public/llms.txt`: the vocabulary block's two views and self-test.
- `docs/process/TODO.md`: E63.
- Issue 108: a reply, drafted for the maintainer's approval, explaining what is built
  and why it differs from the request (W4).
- The pull request opens with the maintainer's framing, drafted 2026-11-12: the layout is
  modernised with the LC template; the 2015 teaching approach is kept — two ways in,
  phrases in the topic view and headwords in A–Z, stress and grammar notes, a recording
  for every entry, self-testing; each word written and recorded once.

## 10. Out of scope

- Issue 108's `sort: false` (W4) and a free-standing "letter headings in written order".
- An audio-only drill (W7).
- An exercise generated from the word bank.
- Converting Russian lessons 2–4 (W9), and any general conversion script in the template.
- Changes to flashcards or other engines that show vocabulary.

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
- **Revealing either side moves focus to the revealed word** (the course-language term
  or the English gloss), so focus never falls to `<body>` (WCAG 2.4.3).
- **Letter headings still show while the course language is hidden,** so each heading
  gives away its words' first letter. The design is silent; left as is.
- **A hidden word is not removed from the DOM** (§5 said it would be). It stays as an
  invisible, `aria-hidden` placeholder (`visibility: hidden`) in the same grid cell as its
  Reveal button, so the cell keeps the word's width. Removing it let the narrower Reveal
  button shrink the column, and the other column jumped about 120px when a side was
  hidden, against §5's "keeps its space". Screen readers still skip it and find-in-page
  does not match it. Found by eye in the browser on 2026-11-13; a browser test now checks
  that neither column moves (maintainer approved, 2026-11-13).
- **§3 rule 5 applies only to a word bank** (maintainer decision, 2026-11-13, found
  against the Russian course's lesson 2). A block is a word bank when it declares `topics`
  or any entry has `only`; a plain `items` list may repeat a term, as before E63, so a
  lesson written as in 2015 still builds (W3). Rows are keyed by the entry's index in the
  authored list, never its term.
- **An entry may belong to several topics** (maintainer decision, 2026-11-13, found
  against 2015 units 2 and 9: "условия" and "вредный" under work and unemployment,
  "учёный" under science and people in education). `topic` is an id or a non-empty list
  of distinct declared ids. The topic view shows the entry under each, in written order;
  A–Z shows it once. It is one word: revealing either copy reveals both, and focus goes
  to the copy whose Reveal was pressed. "word N" counts rows, so the copies differ.
