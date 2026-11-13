# CULP syllabi

The Cambridge Language Centre's current CULP (Cambridge University Language Programme)
syllabi, converted from PDF to Markdown on 2026-10-21: 103 documents in 20 languages.
Staff names and email addresses have been removed. Beside them is the Council of
Europe's CEFR self-assessment grid,
[`european-framework-assessment.md`](european-framework-assessment.md): what a learner
at each CEFR level, A1 to C2, can do in each skill. It is the reference for what a level
means. The 21 programme specifications that came with the syllabi (`*_PS.pdf`, from
2011–2012) were removed on 2026-11-09 as out of date; the grid takes their place. They are here so that anyone turning
a teacher's material into a lesson, people or agents, can check it against the matching
CULP level: what that level covers, and whether the material is too basic or too
advanced for it. In Claude Code, the
[`culp-syllabus`](../../.claude/skills/culp-syllabus/SKILL.md) skill does this check
([below](#the-culp-syllabus-skill)). A `DEBUG=1` build also shows this README on a debug
page of its own, `culp-syllabi.html`.

> **Do not edit the notes by hand.** They are kept exactly as the maintainer supplied
> them. A new or corrected note comes from the maintainer as a Markdown file, and is
> checked and added by pull request; if a note looks wrong, tell the maintainer.
> Prettier skips the folder ([`.prettierignore`](../../.prettierignore)) so that every
> note stays byte-identical to the file supplied. This README is the one exception: it
> is written in the repo.

The syllabi belong to the Language Centre, University of Cambridge. They are shared here
for reference only and are not covered by this repo's CC BY-NC 4.0 licence
([`LICENSE`](../../LICENSE)). Nor is the CEFR grid, which is © Council of Europe.

## Layout

| Path                                                                   | Holds                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`syllabi/`](syllabi/)                                                 | 103 notes, one per document: 102 syllabi and one assessment framework                                             |
| [`languages/`](languages/)                                             | 20 hubs, one per language, listing its documents in level order                                                   |
| [`strands/`](strands/)                                                 | 6 hubs: Medics, BioMed, Academic Reading, Academic Purposes, Business, MBA                                        |
| [`CULP Syllabi.md`](<CULP Syllabi.md>)                                 | the index: every hub, with its counts                                                                             |
| [`european-framework-assessment.md`](european-framework-assessment.md) | the CEFR self-assessment grid: A1 to C2 for listening, reading, spoken interaction, spoken production and writing |

The files form a hierarchy: the index points to the hubs and the CEFR grid, each hub
lists its notes, and each note points back to its hubs and across to the notes around
it.

```text
docs/culp-syllabi/
├── CULP Syllabi.md            the index: every hub, with its counts
├── european-framework-assessment.md
│                              the CEFR self-assessment grid, A1 to C2
├── languages/<Language>.md    one hub per language: its notes, in level order
├── strands/<Strand>.md        one hub per strand: its notes, across languages
└── syllabi/<note>.md          one note per document: a syllabus, or the
                               assessment framework
    links from each note:
    ├── language        →  its language hub
    ├── strand          →  its strand hub, if it has a strand
    ├── previous_level  →  the note before it, same language and strand
    └── next_level      →  the note after it
```

What each kind of file is for:

- **A syllabus** is one course at one level: lesson by lesson (or week by week), the
  topics, language functions and grammar it teaches, and how it is assessed. This is
  the note to check material against.
- **The CEFR grid** says what a CEFR level means: for each level, A1 to C2, a "can do"
  descriptor for listening, reading, spoken interaction, spoken production and writing.
  It is the same for every language, and it is how a syllabus's `cefr` level is read.
- **The assessment framework** sets out how the Advanced level is assessed, in every
  language: methods and the weight of each component.
- **A hub** (`languages/`, `strands/`) and **the index** hold no teaching content: they
  are lists, the way in to the notes.

A note's file name is its language, then its strand if it has one, then its level, then a
theme: [`french-basic-2.md`](syllabi/french-basic-2.md),
`spanish-medics-intermediate-1.md`, `greek-modern-basic-1.md`. Notes link to each other
with Obsidian wikilinks: `[[french-basic-2]]` is `syllabi/french-basic-2.md`, and
`[[French]]` is `languages/French.md`. The folder opens as an Obsidian vault, but it is
plain Markdown with YAML frontmatter, readable by any tool.

## Frontmatter

Every note in `syllabi/` starts with these fields. A field that does not apply is left
out.

| Field                          | Holds                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`, `aliases`             | the document's own title, and a common name (`French Basic 2`)                                                                                                           |
| `doc_type`                     | `syllabus` or `assessment-framework` (the hubs are `language-hub`, `strand-hub` and `index`; the CEFR grid is `cefr-grid`)                                               |
| `language`, `language_code`    | a link to the language's hub, and its ISO code: `fr`, `es`, `de`, `it`, `pt`, `ru`, `zh`, `ja`, `ko`, `ar`, `fa`, `ur`, `he`, `hi`, `el`, `grc`, `la`, `sw`, `tr`, `bfi` |
| `document_language`            | the language the document is written in, when it is not English (French Advanced is in French)                                                                           |
| `level`, `level_order`         | the CULP level, and a number to sort by (below). Five theme courses have no level                                                                                        |
| `strand`                       | `General`, or a link to a strand hub (`"[[Medics]]"`)                                                                                                                    |
| `previous_level`, `next_level` | the levels before and after, in the same language and strand                                                                                                             |
| `related`                      | parallel versions at the same level, and the assessment framework ↔ Portuguese Advanced                                                                                  |
| `cefr`                         | the CEFR level, only where the document states one: `A1` to `C2`, a level in the CEFR grid                                                                               |
| `lessons` or `weeks`           | how many                                                                                                                                                                 |
| `document_date`, `source_date` | the date printed in the document, where it prints one (65 of 103 do not), and the date the original PDF was last modified (every note)                                   |
| `main_text`                    | the course book (Latin)                                                                                                                                                  |

`level_order` puts the levels in course order:

| `level_order` | `level`                                          |
| ------------- | ------------------------------------------------ |
| 10            | Basic 1, Basic, Absolute Beginners, Introduction |
| 20            | Basic 2, Advanced Beginners                      |
| 30            | Elementary 1, Elementary                         |
| 40            | Elementary 2                                     |
| 45            | Pre-Intermediate                                 |
| 50            | Intermediate 1, Intermediate                     |
| 55            | Intermediate 1 to 2 (bridging)                   |
| 60            | Intermediate 2                                   |
| 70            | Upper Intermediate                               |
| 80            | Advanced                                         |
| 90            | Advanced Plus                                    |

The body is one `#` title, then the document's own sections. A lesson grid is one
heading per lesson or week, with bold labels (**Language Functions**, **Grammar and
structures**, …) over lists; most syllabi open with a "Lessons at a glance" table; an
assessment is a `> [!important]` callout. There is no HTML.

## Finding the right note

1. **Language.** A course's `languageCode` in
   [`course.json`](../../course.json), up to any `-`
   (`pt-BR` is `pt`), is the notes' `language_code`. The language's hub in `languages/`
   lists every document for it, in order.
2. **Level.** A course's own title says "Level 1", not a CULP level, so ask which CULP
   course the material is for, then pick the note whose `level` matches, in the right
   `strand` (`General` unless the course is for medics, say).
3. **Around it.** `previous_level` says what learners already know; `next_level` says
   what comes later.
4. **CEFR.** Where the note gives a `cefr` level, the CEFR grid's rows for that level say
   what a learner at it can do in each skill. Where it gives none, say so: do not infer
   one from the CULP level.

## Read them with care

- **They are guidance, not rules**, and many are old: several syllabi date from
  2013–2015. Whatever an answer rests on, name the note, its `source_date`, and its
  `document_date` where it has one; for a CEFR level, name the CEFR grid.
- **Vocabulary is named by topic at most** ("common vocabulary in legends and fairy
  tales"), never as word lists. Whether a word suits a level is a judgement, not
  something a note says.
- **The teaching content is the reliable part.** About 38 notes contradict themselves,
  mostly on when assessments happen and what they are worth, and those are still with
  the teachers. About 40 syllabi give no assessment weights at all.
- **The template is left-to-right only for now.** The Arabic, Persian, Urdu and Hebrew
  syllabi are here for when right-to-left support lands
  ([`ROADMAP.md` §1](../ROADMAP.md#1-right-to-left-languages-persian-arabic)).

## The `culp-syllabus` skill

The [`culp-syllabus`](../../.claude/skills/culp-syllabus/SKILL.md) skill is how an agent
uses these notes. Claude Code loads it by itself when someone asks whether lesson
material fits a CULP level, or what a level covers: "check this Word document against
the syllabus", "is this too advanced for French Basic 2?", "what does Spanish Basic 1
cover?". Other agents can read its steps.

- **It finds the note** the way [Finding the right note](#finding-the-right-note) does,
  and confirms it with the user: title, level, strand and dates.
- **It reads around the note:** the note, then the notes its `previous_level` and
  `next_level` name, so it can say what learners already know and what comes later, and
  the CEFR grid's rows for the note's `cefr` level, so it can say what that level means.
- **It reads the material:** a Markdown, text, JSON or PDF file, a lesson already in
  `lo-config/`, or a Word document converted to text without saving it.
- **It reports in plain language,** for a developer rather than a linguist: what fits,
  what is above or below the level (naming the note and lesson where a structure first
  appears), suggestions, and the notes it used with their dates, as
  [Read them with care](#read-them-with-care) asks.

It only reads. It never edits a note or the lesson, and never saves the teacher's
material in the repo; changing a lesson is the `add-lo` skill's job, and only when the
user asks.

## Adding or updating notes

1. **The maintainer supplies the files**: new notes, or corrected ones that replace a
   note of the same name. Put each in its folder (`syllabi/`, `languages/`, `strands/`)
   exactly as supplied.
2. **A new note joins the web.** Its language hub lists it, so does its strand hub if it
   has a strand, and the levels around it link back to it. Those are notes too, so they come from the maintainer as well.
3. **Run `bun run test`.** [`src/docs/culp-syllabi.test.ts`](../../src/docs/culp-syllabi.test.ts)
   checks every note: its fields and file name, its level against the table above, its
   dates, that every link leads to a note and runs both ways, the hubs and the index,
   that the CEFR grid has every level for every skill and every `cefr` value is one of
   them, no email address and no HTML, and the numbers in this README. When it names a problem in
   a note, tell the maintainer, who decides the fix. When it names a number here, update
   the README.
4. **Open a pull request** for the change
   ([`CONTRIBUTING.md` → "How a change reaches `main`"](../../CONTRIBUTING.md#how-a-change-reaches-main)).
