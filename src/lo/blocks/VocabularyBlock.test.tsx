/**
 * VocabularyBlock.test.tsx — the gloss lines up with its term. The term shares a
 * centred row with its 54px speaker (maintainer, 2026-10-08), so the gloss centres in
 * the row too instead of riding at the top.
 */
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VocabularyBlock } from './VocabularyBlock';

test('centres each gloss against its term and speaker', () => {
  const html = renderToStaticMarkup(
    <VocabularyBlock
      content={{
        items: [
          { term: 'la casa', gloss: 'the house', audio: 'audio/lo-00-example/placeholder.m4a' },
        ],
      }}
    />,
  );

  expect(html).toContain('<dd class="self-center text-muted-foreground">the house</dd>');
});

const items = [
  { term: 'Salut', gloss: 'hi' },
  { term: 'Bonjour', gloss: 'hello' },
];

// Maintainer, 2026-10-08, after french-lo-1: a "You will learn" info alert and two
// sort buttons above the terms.
describe('vocabulary summary and sort', () => {
  test('renders the summary as an info alert: the lead, then a ticked list', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock
        content={{
          summary: { lead: 'You will learn:', items: ['Greetings (<em>Hola</em>)', 'Farewells'] },
          items,
        }}
      />,
    );

    expect(html).toContain('role="note"');
    expect(html).toContain('You will learn:');
    expect(html).toContain('<em>Hola</em>');
    expect((html.match(/<li/g) ?? []).length).toBe(2);
    expect(html.indexOf('You will learn:')).toBeLessThan(html.indexOf('<dl'));
  });

  test('offers Semantic and Alphabetical above the terms, Semantic pressed first', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={{ items }} />);

    expect(html).toContain('role="group" aria-label="Choose a view"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Semantic<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Alphabetical<\/button>/);
    expect(html.indexOf('Semantic')).toBeLessThan(html.indexOf('<dl'));
    // Authored order until the learner sorts.
    expect(html.indexOf('Salut')).toBeLessThan(html.indexOf('Bonjour'));
  });

  // Maintainer, 2026-10-08: the alert once sat flush against the accordion header and
  // carried its own mt-2. Every accordion body now has that 8px of top padding
  // (LoAccordion), so the alert must not add a second 8px on top of it.
  test('leaves the space above the summary alert to the accordion body', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock
        content={{ summary: { lead: 'You will learn:', items: ['Greetings'] }, items }}
      />,
    );
    expect(html).toMatch(/role="note"/);
    expect(html).not.toMatch(/role="note"[^>]*class="[^"]*\bmt-2\b/);
  });

  test('hides the sort buttons when there is nothing to sort', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock content={{ items: [{ term: 'Hola', gloss: 'hello' }] }} />,
    );
    expect(html).not.toContain('Choose a view');
  });
});

// E63 (spec §3–4): a word bank. The first render is the topic view with nothing
// hidden, so the prerendered markup equals the first client render.
const BANK = {
  topics: [{ id: 'greetings', heading: 'Greetings' }, { id: 'farewells' }],
  items: [
    { term: 'hola', gloss: 'hello', topic: 'greetings' },
    { term: 'buenos días', gloss: 'good morning', topic: 'greetings', only: 'topics' },
    { term: 'adiós', gloss: 'goodbye', topic: 'farewells' },
    { term: 'saludar', gloss: 'to greet', only: 'alphabetical' },
  ],
};

describe('vocabulary word bank, first render', () => {
  test('is the topic view: topic entries in written order, A–Z-only entries left out', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} />);
    expect(html.indexOf('hola')).toBeLessThan(html.indexOf('buenos días'));
    expect(html.indexOf('buenos días')).toBeLessThan(html.indexOf('adiós'));
    expect(html).not.toContain('saludar');
  });

  test('heads each topic with an <h4> inside a card, and gives each topic its own <dl>', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} />);
    expect(html).toMatch(/<h4[^>]*>Greetings<\/h4>/);
    expect((html.match(/<dl/g) ?? []).length).toBe(2);
  });

  test('heads each topic with an <h3> in a plain block, under the section <h2>', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} presentation="plain" />);
    expect(html).toMatch(/<h3[^>]*>Greetings<\/h3>/);
    expect(html).not.toContain('<h4');
  });

  test('a topic without a heading is a divider', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={BANK} />);
    expect((html.match(/<hr/g) ?? []).length).toBe(1);
    expect(html.indexOf('<hr')).toBeLessThan(html.indexOf('adiós'));
  });

  test('a list without topics is still one <dl>, as before', () => {
    const html = renderToStaticMarkup(<VocabularyBlock content={{ items }} />);
    expect(html).toContain(
      '<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-[fit-content(50%)_minmax(0,1fr)]">',
    );
    expect((html.match(/<dl/g) ?? []).length).toBe(1);
    expect(html).not.toContain('<h4');
  });

  test('no view buttons when one view would be empty', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock
        content={{
          items: [
            { term: 'b', gloss: 'b', only: 'alphabetical' },
            { term: 'a', gloss: 'a', only: 'alphabetical' },
          ],
        }}
      />,
    );
    expect(html).not.toContain('Choose a view');
    // The one view with entries shows: A–Z.
    expect(html.indexOf('>a<')).toBeLessThan(html.indexOf('>b<'));
  });

  test('a block renames the view buttons through its labels', () => {
    const html = renderToStaticMarkup(
      <VocabularyBlock content={BANK} labels={{ vocabularySemantic: 'By topic' }} />,
    );
    expect(html).toContain('By topic');
    expect(html).not.toContain('Semantic');
  });
});

// A plain list may repeat a term (the 2015 units teach some words twice); it must render
// both rows and re-sort without duplicate React keys.
describe('a plain list with a repeated term', () => {
  const content = {
    items: [
      { term: 'условия', gloss: 'conditions' },
      { term: 'вредный', gloss: 'harmful' },
      { term: 'условия', gloss: 'conditions' },
    ],
  };
  const dts = (html: string) => Array.from(html.matchAll(/<dt[^>]*>.*?<\/dt>/g)).length;

  test('renders both rows', () => {
    expect(dts(renderToStaticMarkup(<VocabularyBlock content={content} />))).toBe(3);
  });
});
