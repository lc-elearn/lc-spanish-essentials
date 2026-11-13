/**
 * vocabulary-block-css.test.ts — the A–Z view's letter headings (E63, spec §4, W6):
 * the letter centred, a thin rule either side, drawn by empty pseudo-elements so a
 * screen reader hears the letter alone.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(path.join(import.meta.dirname, 'vocabulary-block.css'), 'utf8');

describe('vocabulary-block.css letter headings', () => {
  test('lives in the components layer', () => {
    expect(css).toMatch(/@layer components\s*\{/);
  });

  test('centres the letter between two flexible rules', () => {
    expect(css).toMatch(/\.vocabulary-letter\s*\{[^}]*display: flex;[^}]*align-items: center;/);
    expect(css).toMatch(
      /\.vocabulary-letter::before,\s*\.vocabulary-letter::after\s*\{[^}]*content: '';[^}]*flex: 1;/,
    );
  });

  test('draws each rule as a 1px border in the border token', () => {
    expect(css).toMatch(/border-block-start: 1px solid var\(--border\);/);
  });
});
