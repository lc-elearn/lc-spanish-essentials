// src/build/debug-pages-in.test.ts
import { describe, expect, it } from 'vitest';
import { DEBUG_ENTRY_FILES } from './page-names';
import { findDebugPages } from './debug-pages-in';

describe('findDebugPages', () => {
  it('returns nothing for a course build', () => {
    expect(findDebugPages(['index.html', 'example.html', 'lo-01-greetings.html'])).toEqual([]);
  });

  it('names every debug page present, in the order given', () => {
    expect(findDebugPages(['index.html', 'ui-showcase.html', 'exercise-showcase.html'])).toEqual([
      'ui-showcase.html',
      'exercise-showcase.html',
    ]);
  });

  it('knows every page in DEBUG_ENTRY_FILES', () => {
    const all = Object.values(DEBUG_ENTRY_FILES);
    expect(findDebugPages(all)).toEqual(all);
  });

  it('ignores files that only contain a debug name', () => {
    expect(findDebugPages(['my-ui-showcase.html', 'ui-showcase.html.bak'])).toEqual([]);
  });
});
