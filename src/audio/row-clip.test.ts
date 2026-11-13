// @vitest-environment happy-dom
/**
 * row-clip.test.ts — when a click on a row plays the row's clip (E62).
 * Spec: docs/specs/2026-11-12-row-click-audio-design.md §4.
 */
import type { MouseEvent } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { playRowClip, ROW_CLIP_CLASSES, shouldPlayRowClip } from './row-clip';

afterEach(() => {
  document.body.innerHTML = '';
});

const SPEAKER = '<button type="button" data-row-clip-speaker="">speaker</button>';

/** A row in the document; `played` counts presses of its marked speaker. */
function makeRow(inner: string, outer = (row: string) => row) {
  document.body.innerHTML = outer(`<li id="row">${inner}</li>`);
  const row = document.getElementById('row');
  if (row === null) throw new Error('no row');
  const played = vi.fn();
  row.querySelector('[data-row-clip-speaker]')?.addEventListener('click', played);
  return { row, played };
}

function clickRow(row: HTMLElement, target: Element): void {
  playRowClip({ currentTarget: row, target } as unknown as MouseEvent<HTMLElement>);
}

describe('ROW_CLIP_CLASSES', () => {
  test('declares no transition (TODO §D8: never transition a base-state token colour)', () => {
    expect(ROW_CLIP_CLASSES.split(/\s+/).filter((c) => c.includes('transition'))).toEqual([]);
  });
});

describe('playRowClip', () => {
  test('a click on the row text presses the speaker', () => {
    const { row, played } = makeRow(`${SPEAKER}<p id="text">la casa</p>`);
    clickRow(row, row.querySelector('#text') as Element);
    expect(played).toHaveBeenCalledTimes(1);
  });

  test('a click on the row itself presses the speaker', () => {
    const { row, played } = makeRow(SPEAKER);
    clickRow(row, row);
    expect(played).toHaveBeenCalledTimes(1);
  });

  test('presses the marked speaker, not the first button', () => {
    const { row, played } = makeRow(
      `<button type="button" id="tile">tile</button>${SPEAKER}<p id="text">x</p>`,
    );
    const tile = vi.fn();
    row.querySelector('#tile')?.addEventListener('click', tile);
    clickRow(row, row.querySelector('#text') as Element);
    expect(played).toHaveBeenCalledTimes(1);
    expect(tile).not.toHaveBeenCalled();
  });

  test('a row with no marked speaker does nothing', () => {
    const { row } = makeRow('<button type="button" id="b">b</button><p id="text">x</p>');
    const b = vi.fn();
    row.querySelector('#b')?.addEventListener('click', b);
    clickRow(row, row.querySelector('#text') as Element);
    expect(b).not.toHaveBeenCalled();
  });
});

describe('playRowClip with a real selection', () => {
  test('selected row text does not press the speaker', () => {
    const { row, played } = makeRow(`${SPEAKER}<p id="text">la casa</p>`);
    const text = row.querySelector('#text') as Element;
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(window.getSelection()?.toString()).toBe('la casa');
    clickRow(row, text);
    window.getSelection()?.removeAllRanges();
    expect(played).not.toHaveBeenCalled();
  });
});

describe('shouldPlayRowClip', () => {
  test.each([
    ['the speaker itself', '', '[data-row-clip-speaker]'],
    [
      'an icon inside the speaker',
      '<button type="button" data-row-clip-speaker=""><svg><path id="t"/></svg></button>',
      '#t',
    ],
    ['an editable region', '<div contenteditable id="t">x</div>', '#t'],
    ['a role=link', '<span role="link" id="t">x</span>', '#t'],
    ['a role=checkbox', '<span role="checkbox" id="t">x</span>', '#t'],
    ['a role=switch', '<span role="switch" id="t">x</span>', '#t'],
    ['a role=option', '<span role="option" id="t">x</span>', '#t'],
    ['a role=slider', '<span role="slider" id="t">x</span>', '#t'],
    ['a button', '<button type="button" id="t">x</button>', '#t'],
    ['a link', '<a href="#x" id="t">x</a>', '#t'],
    ['a text box', '<input id="t" />', '#t'],
    ['a dropdown', '<select id="t"><option>x</option></select>', '#t'],
    ['a text area', '<textarea id="t"></textarea>', '#t'],
    ['a label', '<label id="t">x</label>', '#t'],
    ['a draggable tile', '<span draggable="true" id="t">x</span>', '#t'],
    ['a combobox', '<div role="combobox" id="t">x</div>', '#t'],
    ['text inside a button', '<button type="button"><span id="t">x</span></button>', '#t'],
  ])('a click on %s does not play', (_name, inner, selector) => {
    const { row } = makeRow(`${SPEAKER}${inner}`);
    expect(shouldPlayRowClip(row.querySelector(selector), row, '')).toBe(false);
  });

  test.each([
    ['a non-editable region', '<div contenteditable="false" id="t">x</div>'],
    ['an anchor with no href', '<a id="t">x</a>'],
  ])('a click on %s plays', (_name, inner) => {
    const { row } = makeRow(`${SPEAKER}${inner}`);
    expect(shouldPlayRowClip(row.querySelector('#t'), row, '')).toBe(true);
  });

  test('a row that is itself an option still plays on a click on its text', () => {
    const { row } = makeRow(`${SPEAKER}<p id="t">x</p>`);
    row.setAttribute('role', 'option');
    expect(shouldPlayRowClip(row.querySelector('#t'), row, '')).toBe(true);
  });

  test('a control OUTSIDE the row does not stop it', () => {
    const { row } = makeRow(
      `${SPEAKER}<p id="t">x</p>`,
      (inner) => `<div role="option">${inner}</div>`,
    );
    expect(shouldPlayRowClip(row.querySelector('#t'), row, '')).toBe(true);
  });

  test('selected text does not play', () => {
    const { row } = makeRow(`${SPEAKER}<p id="t">la casa</p>`);
    expect(shouldPlayRowClip(row.querySelector('#t'), row, 'la casa')).toBe(false);
  });

  test('a target outside the row does not play', () => {
    const { row } = makeRow(SPEAKER);
    const elsewhere = document.createElement('p');
    document.body.append(elsewhere);
    expect(shouldPlayRowClip(elsewhere, row, '')).toBe(false);
  });
});
