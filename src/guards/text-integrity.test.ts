/**
 * text-integrity.test.ts — guard i (TODO §E60).
 *
 * The text below is wrong ON PURPOSE: decomposed accents, marks with no letter, Latin
 * letters inside Russian words. Every bad string is spelt with `\u` escapes, so the
 * mistake is visible in the source, and this file sits outside the folders the guard
 * sweeps. Spec: docs/specs/2026-11-12-text-integrity-guard-design.md.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TARGET_LANG } from '@/lib/lang';
import {
  authoredStrings,
  collectStrings,
  findTextProblems,
  LANGUAGE_PROFILES,
  profileFor,
  type TextProblem,
} from './text-integrity';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const RU = profileFor('ru');
const ACUTE = '\u0301';

/** Just the kinds, for the many tests that only ask which rule fired. */
const kinds = (problems: readonly TextProblem[]): string[] => problems.map((p) => p.kind);

describe('collectStrings — every authored string in a config tree', () => {
  it('finds strings nested through objects and arrays, in order', () => {
    const config = { title: 'Дом', blocks: [{ html: '<em>a</em>' }, { items: ['b', 'c'] }] };
    expect(collectStrings(config)).toEqual(['Дом', '<em>a</em>', 'b', 'c']);
  });

  it('skips asset paths: guard d owns them, and a Mac file name may be NFD by design', () => {
    // A file name dragged from the Finder arrives decomposed; guard d and resolveAsset()
    // accept either form, so failing it here would fail a path that works.
    const config = {
      audio: 'audio/cancio\u0301n.mp3',
      image: { src: 'images/cancio\u0301n.png', alt: 'Канцо' },
      text: 'ok',
    };
    expect(collectStrings(config)).toEqual(['Канцо', 'ok']);
  });

  it('ignores keys, numbers, booleans and null', () => {
    expect(collectStrings({ ['Д\u0065лая']: 1, ok: true, none: null })).toEqual([]);
  });
});

describe('rule 1 — normalisation (NFC)', () => {
  it('passes precomposed accents in any language', () => {
    expect(findTextProblems('café, Ñandú, Straße, ça, ё, й')).toEqual([]);
  });

  it('fails an accent stored as letter + separate mark, naming the word', () => {
    const problems = findTextProblems(`un cafe${ACUTE} con leche`);
    expect(kinds(problems)).toEqual(['not-nfc']);
    expect(problems[0]?.detail).toContain('cafe');
    expect(problems[0]?.detail).toContain('U+0301');
    expect(problems[0]?.detail).toContain('café'); // what it should read
  });

  it('names what a look-alike character should be, not only accents', () => {
    // U+212B ANGSTROM SIGN is Å (U+00C5) to NFC; retyping an accent is not the fix here.
    const problems = findTextProblems('10 \u212B');
    expect(kinds(problems)).toEqual(['not-nfc']);
    expect(problems[0]?.detail).toContain('\u00C5');
  });

  it('fails a decomposed й or ё in Russian (from a PDF), reported once', () => {
    expect(kinds(findTextProblems(`мои${'\u0306'} дом`, RU))).toEqual(['not-nfc']);
    expect(kinds(findTextProblems(`е${'\u0308'}лка`, RU))).toEqual(['not-nfc']);
  });

  it('passes a Russian stress mark, which has no precomposed form', () => {
    // NFC keeps о + U+0301 as two code points: there is nothing to compose them into.
    const stressed = `молоко${ACUTE}`;
    expect(stressed.normalize('NFC')).toBe(stressed);
    expect(findTextProblems(stressed, RU)).toEqual([]);
  });
});

describe('rule 2 — a combining mark needs a letter under it', () => {
  it('fails the Russian course’s real mistake: a mark after a space', () => {
    const problems = findTextProblems(`(на ${ACUTE} Acc)`);
    expect(kinds(problems)).toEqual(['stray-mark']);
    expect(problems[0]?.detail).toContain('U+0301');
    expect(problems[0]?.detail).toContain('на');
  });

  it('fails a mark after a bracket, at the start, or after a tag', () => {
    expect(kinds(findTextProblems(`(${ACUTE}Acc)`))).toEqual(['stray-mark']);
    expect(kinds(findTextProblems(`${ACUTE}abc`))).toEqual(['stray-mark']);
    expect(kinds(findTextProblems(`<em>${ACUTE}</em>`))).toEqual(['stray-mark']);
  });

  it('passes marks on letters, stacked marks included', () => {
    expect(findTextProblems(`ко${ACUTE}шка`)).toEqual([]);
    expect(findTextProblems('q\u0323\u0301')).toEqual([]); // q has no precomposed form
  });

  it('passes a mark shown on its own on the dotted circle ◌', () => {
    expect(findTextProblems(`stress is marked with an acute (◌${ACUTE})`)).toEqual([]);
  });

  it('passes a mark shown on its own on a no-break space, the Unicode Standard’s way', () => {
    expect(findTextProblems(`the acute (\u00A0${ACUTE})`)).toEqual([]);
  });

  it('fails a mark just after a closing tag: it belongs inside, on its letter', () => {
    expect(kinds(findTextProblems(`<b>о</b>${ACUTE}`))).toEqual(['stray-mark']);
  });

  it('passes emoji with a variation selector or a keycap', () => {
    expect(
      findTextProblems('Bien \u2764\uFE0F \u{1F44D}\u{1F3FD} 1\uFE0F\u20E3 \u2714\uFE0F'),
    ).toEqual([]);
  });

  it('fails each stray mark in a string, not just the first', () => {
    expect(kinds(findTextProblems(`a ${ACUTE} b ${ACUTE} c`))).toEqual([
      'stray-mark',
      'stray-mark',
    ]);
  });
});

describe('rule 3 — one word, one script (Latin, Cyrillic, Greek)', () => {
  it('fails a Latin letter inside a Russian word, naming the odd letter', () => {
    const problems = findTextProblems('Д\u0065лая'); // Latin e
    expect(kinds(problems)).toEqual(['mixed-script']);
    expect(problems[0]?.detail).toContain('Latin');
    expect(problems[0]?.detail).toContain('U+0065');
  });

  it('fails a Latin capital at the start of a Russian word, inside «»', () => {
    expect(kinds(findTextProblems('«\u004Dосквы»'))).toEqual(['mixed-script']);
  });

  it('fails a precomposed Latin é where a stressed Cyrillic е was meant', () => {
    expect(kinds(findTextProblems('Д\u00E9лая', RU))).toEqual(['mixed-script']);
  });

  it('fails Latin mixed with Greek, and Cyrillic mixed with Greek', () => {
    expect(kinds(findTextProblems('\u03BFk'))).toEqual(['mixed-script']); // Greek \u03BF
    expect(kinds(findTextProblems('д\u03BFм'))).toEqual(['mixed-script']);
  });

  it('passes an English gloss beside a Russian word', () => {
    expect(findTextProblems(`<strong>дом</strong> (house), "Wi-Fi", SMS-ка, XXI век`)).toEqual([]);
  });

  it('passes modifier letters such as ʲ in a Cyrillic word: they are notation', () => {
    // ʲ (U+02B2) is Latin script to Unicode; Russian phonetics marks softness with it.
    expect(findTextProblems('[дʲ], тʲ, [ˈmʲæsə], kʰ')).toEqual([]);
  });

  it('passes IPA, whose β θ χ are Greek code points', () => {
    expect(findTextProblems('[ˈβaka], [θiŋk], [ˈxoχa]')).toEqual([]);
  });

  it('passes scripts it does not compare, such as Japanese kanji + kana', () => {
    expect(findTextProblems('食べる、日本語')).toEqual([]);
  });

  it('passes a Russian word with a stress mark (marks are not a script)', () => {
    expect(findTextProblems(`Де${ACUTE}лая`, RU)).toEqual([]);
  });
});

describe('rule 4 — the language profile', () => {
  it('has Russian, and nothing else yet', () => {
    expect(Object.keys(LANGUAGE_PROFILES)).toEqual(['ru']);
  });

  it('reads the primary subtag, in any case', () => {
    expect(profileFor('ru')).toBe(LANGUAGE_PROFILES.ru);
    expect(profileFor('ru-RU')).toBe(LANGUAGE_PROFILES.ru);
    expect(profileFor('RU')).toBe(LANGUAGE_PROFILES.ru);
  });

  it('has no profile for a code with no entry, or an inherited object key', () => {
    expect(profileFor('es')).toBeUndefined();
    expect(profileFor('constructor')).toBeUndefined();
  });

  it('passes a stress mark on every Cyrillic vowel, capitals and ё included', () => {
    const vowels = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ';
    for (const vowel of vowels) expect(findTextProblems(`${vowel}${ACUTE}`, RU)).toEqual([]);
  });

  it('fails a stress mark on a Cyrillic consonant under ru, naming the letter', () => {
    const problems = findTextProblems(`кн${ACUTE}ига`, RU);
    expect(kinds(problems)).toEqual(['misplaced-mark']);
    expect(problems[0]?.detail).toContain('н');
  });

  it('fails a stress mark on a Latin letter under ru', () => {
    // q has no precomposed acute, so NFC leaves the mark for rule 4 to see.
    expect(kinds(findTextProblems(`q${ACUTE}`, RU))).toEqual(['misplaced-mark']);
  });

  it('fails a stress mark NFC has composed onto к or г (Macedonian ќ, ѓ) under ru', () => {
    // к + U+0301 is one letter after NFC, so the mark is no longer a code point of its own.
    expect(kinds(findTextProblems(`к${ACUTE}то`, RU))).toEqual(['not-nfc', 'misplaced-mark']);
    expect(kinds(findTextProblems('\u045Cто', RU))).toEqual(['misplaced-mark']);
    expect(kinds(findTextProblems('\u0403ород', RU))).toEqual(['misplaced-mark']);
  });

  it('passes a precomposed accented letter of another script under ru (a French gloss)', () => {
    expect(findTextProblems(`кафе${ACUTE} (from French café, Pelé)`.normalize('NFC'), RU)).toEqual(
      [],
    );
  });

  it('leaves Macedonian ќ alone with no profile', () => {
    expect(findTextProblems('\u045Cе')).toEqual([]);
  });

  it('leaves the same text alone with no profile', () => {
    expect(findTextProblems(`кн${ACUTE}ига`)).toEqual([]);
  });

  it('does not report a mark twice: one with no letter is stray, not misplaced', () => {
    expect(kinds(findTextProblems(`на ${ACUTE} Acc`, RU))).toEqual(['stray-mark']);
  });
});

describe('the repo itself obeys guard i', () => {
  const authored = authoredStrings(REPO_ROOT);

  // A collector that silently finds nothing reports green having checked nothing.
  it('finds authored strings to check, from lessons and course.json', () => {
    expect(authored.length).toBeGreaterThan(100);
    expect(authored.some((entry) => entry.source.startsWith('lo-config/'))).toBe(true);
    expect(authored.some((entry) => entry.source === 'course.json')).toBe(true);
  });

  it('has no invisible text mistakes, under the course’s own language profile', () => {
    const profile = profileFor(TARGET_LANG);
    const problems = authored.flatMap((entry) =>
      findTextProblems(entry.value, profile).map((problem) => ({ ...entry, ...problem })),
    );
    expect(
      problems,
      `invisible text mistakes (spec: docs/specs/2026-11-12-text-integrity-guard-design.md):\n${problems
        .map((p) => `  ${p.source} → ${p.kind}: ${p.detail}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
