# Guard i — text integrity (E60)

**Date:** 2026-11-12 · **Status:** built 2026-11-12 (TODO §E60)
**Code:** `src/guards/text-integrity.ts`, tests beside it · **Replaces:** the accent and
Latin-letter checks of the Russian course's own `check-learning-object` script (course
PR 8)

## 1. Why

Some mistakes in lesson text cannot be seen. The Russian course shipped `(на ́ Acc)` for
`(на + Acc)` 33 times in lesson 2 (24 after a space, 9 after a bracket): a stress mark
with no letter under it, pasted where a plus sign belonged. Its author wrote a script,
`check-learning-object`, that finds stray stress marks and Latin letters inside Russian
words (`Дeлая` with a Latin `e`). The script is run by hand, has no tests, knows only
Russian, and its missing-file check repeats guard d.

Most of what it checks needs no knowledge of any language, so it belongs in the
template, run by `bun run test` in every course's CI, whatever the course teaches. Only
"a stress mark sits on a vowel" is Russian, and that is keyed on `course.json`'s
`languageCode`.

## 2. What is checked

Every string value in `lo-config/**/*.json` and in `course.json`, collected by walking
the parsed JSON (as guard d collects asset keys, but every string except the asset paths,
§4).
Strings may hold HTML (`<em>…</em>`); a **word** is a run of letters and combining marks
(`[\p{L}\p{M}]+`), so tags, spaces, digits and punctuation split words.

| Rule              | Fails when                                                                                              | Example                      |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Normalisation** | the string is not in NFC (`s !== s.normalize('NFC')`)                                                   | `é` stored as `e` + U+0301   |
| **Stray mark**    | a combining mark has no letter under it (it follows a space, punctuation, a tag or the start)           | `(на ́ Acc)`                  |
| **Mixed script**  | one word holds letters from two of Latin, Cyrillic and Greek                                            | `Дeлая`, `Mосквы` (Latin M)  |
| **Profile**       | a mark the course's language restricts sits on a letter it may not (only `ru` today: U+0301 on a vowel) | `кни́га` is fine; `кн́ига` not |

Rules 2–4 read the NFC form, so a decomposed accent is reported once, as rule 1. Rule 1's
message shows what each word should read (`«cafe‹U+0301›» should read «café»`), since it
also fires for a look-alike character such as the Ångström sign U+212B.

**What passes, on purpose:**

- Russian stress marks. Cyrillic vowels have no precomposed form with an acute, so NFC
  keeps `о` + U+0301 as two code points. That is correct text and passes rule 1.
- An English gloss beside a Russian word: they are two words.
- A mark shown on its own for teaching, put on the dotted circle `◌` (U+25CC, as the code
  charts show it) or a no-break space (U+00A0, the Unicode Standard's way): `◌́`. A plain
  space under a mark is not accepted, because that is exactly the `(на ́ Acc)` mistake.
- Emoji: a variation selector (U+FE0F) and the keycap mark (U+20E3) are marks to
  Unicode, but belong to the emoji before them.
- IPA in a Latin word: `β`, `θ` and `χ` are Greek code points the IPA itself uses, so a
  Latin word whose only Greek letters are these passes (`[ˈβaka]`).
- Modifier letters (`ʲ ʰ ˈ`, `\p{Lm}`) belong to no word's alphabet: Unicode calls `ʲ`
  Latin, but Russian phonetics writes softness as `[дʲ]`, which passes.
- Scripts other than Latin, Cyrillic and Greek are not compared: Japanese mixes kanji
  and kana in one word by design, and only these three share look-alike letters.

## 3. The language profile

```ts
export const LANGUAGE_PROFILES = {
  ru: { markBases: { '\u0301': 'аеёиоуыэюяАЕЁИОУЫЭЮЯ' } },
};
```

Keyed on the primary subtag of `TARGET_LANG` (`src/lib/lang.ts`, which is
`course.json`'s `languageCode`), so `ru` and `ru-RU` both read `ru`. A course whose code
has no entry gets rules 1–3 only. Adding a language is one entry: a mark and the letters
it may sit on.

NFC composes a stress mark on к or г into one letter, Macedonian `ќ` or `ѓ`, so rule 4
also looks inside a letter of the allowed letters' own script: `ќ` under `ru` fails, as
`к` + U+0301 does. A precomposed letter of another script is that script's own letter
and passes: the `é` of a French gloss in a Russian lesson. `ё` is in Russian's list although it is always stressed: a mark on it is
redundant, not wrong, and the author's own script accepts it.

## 4. What is not swept

- **Showcase fixtures** (`src/showcase/fixtures.ts`): the template's own demo text, the
  same in every course and reviewed by the maintainer. A course's language profile does
  not describe it (it is Spanish in the Russian course).
- **This guard's test file**, which holds the bad text on purpose. It lives in
  `src/guards/`, outside the swept folders.
- **Asset paths**, a string directly under one of guard d's `ASSET_KEYS` (`audio`,
  `image`, `src`, `logo`, `favicon`): not text a learner reads, and guard d owns them. A
  file name dragged from the Finder arrives NFD (`canción.mp3` as `o` + U+0301), and guard
  d and `resolveAsset()` accept either form, so rule 1 would fail a path that works. An
  image's `alt` is text, and is swept.
- **JSON keys**: schema field names, not authored text.
- **HTML entities** (`&#769;`) are not decoded: the only entity in any course's lessons
  today is `&amp;`.

**Known limits, left on purpose** (found in review, 2026-11-12; none occurs in any course):

- A variation selector (U+FE0F) is not checked for what it sits on, so one after a space
  passes.
- A spacing acute `´` (U+00B4) typed as a stress mark (`молоко´`) is not a combining mark,
  so no rule sees it.
- A unit symbol that mixes Latin and Greek in one word, such as `kΩ`, fails rule 3. No
  language lesson has one; a course that needs it would add an exception here first.

## 5. Checked before turning it on

The guard ran over every course's lessons before it could fail anyone's CI, each under
its own `languageCode`. "Files" counts `course.json`; "strings" leaves out asset paths.

| Source (language)                                               | Files | Strings | Hits                                                  |
| --------------------------------------------------------------- | ----- | ------- | ----------------------------------------------------- |
| template: the example lesson (`es`)                             | 19    | 190     | 0                                                     |
| Russian `lo-04-2015-shape`, lessons 1–4 (`ru`)                  | 115   | 2,867   | 0; 1,098 stress marks, all on a vowel                 |
| Russian `main`, lessons 1–3 (`ru`)                              | 90    | 2,141   | 0                                                     |
| Russian `lo-04-festivals` (`ru`)                                | 115   | 2,867   | 0                                                     |
| Russian `restructure-lessons-1-3` (`ru`)                        | 95    | 2,200   | 0                                                     |
| Russian `8a61dc5`, lesson 2 added, before the plus-sign fix     | 63    | 1,386   | 33, all `stray-mark`: the `(на ‹U+0301› Acc)` mistake |
| Russian `6308ce9`, the last commit before the plus-sign fix     | 87    | 2,112   | the same 33                                           |
| Spanish `pilot-r1-lesson`, the rules pilot's test lesson (`es`) | 31    | 318     | 0                                                     |

French and German have no lesson of their own yet. Every commit in the Russian course's
history that touches `lo-config/` was also scanned: only `8a61dc5` and `6308ce9` have a
hit. The Latin-letter mistakes the author's script was written for never reached git.

## 6. After it ships

Once the update reaches the Russian course, its author can drop the script's accent and
Latin-letter checks (rules 2–4 cover them) and its missing-file check (guard d), keeping
only the card-and-banner rule, which is a course decision.
