/**
 * Tests for the instruction copy map and resolver (handover spec §3, §7).
 */
import { describe, expect, test } from 'vitest';
import { EXERCISE_TYPE_KEYS } from '@/config/exercise-types';
import {
  EXERCISE_INSTRUCTIONS,
  SAVED_PROGRESS_INSTRUCTIONS,
  resolveInstructions,
  resolveSetInstructions,
  savesProgress,
} from './instructions';

describe('EXERCISE_INSTRUCTIONS', () => {
  test('has non-empty copy for every exercise type key (exhaustive)', () => {
    for (const type of EXERCISE_TYPE_KEYS) {
      const copy = EXERCISE_INSTRUCTIONS[type];
      expect(typeof copy).toBe('string');
      expect(copy.trim().length).toBeGreaterThan(0);
    }
  });

  test('has no extra keys beyond EXERCISE_TYPE_KEYS', () => {
    expect(Object.keys(EXERCISE_INSTRUCTIONS).sort()).toEqual([...EXERCISE_TYPE_KEYS].sort());
  });

  test('memory-match copy references Reset but not Check (§4 caveat)', () => {
    const copy = EXERCISE_INSTRUCTIONS['memory-match'];
    expect(copy).toContain('**Reset**');
    expect(copy).not.toContain('Check');
  });

  // Maintainer, 2026-10-12: the game has Show answers (after two misses), so say so.
  test('memory-match copy names Show answers and when it appears', () => {
    const copy = EXERCISE_INSTRUCTIONS['memory-match'];
    expect(copy).toContain('**Show answers**');
    expect(copy).toMatch(/two misses/);
  });

  // Maintainer, 2026-10-12: both flip engines name the card's corner, "Tap to flip", so
  // the instruction carries its pointer glyph; a mouse user is told a click works too.
  test.each(['memory-match', 'flashcards'] as const)(
    '%s copy names the Tap to flip cue and says a click works',
    (type) => {
      const copy = EXERCISE_INSTRUCTIONS[type];
      expect(copy).toContain('**Tap to flip**');
      expect(copy).toMatch(/or click/);
    },
  );
});

describe('resolveInstructions', () => {
  test('returns the type default when override is absent', () => {
    expect(resolveInstructions('select')).toBe(EXERCISE_INSTRUCTIONS.select);
    expect(resolveInstructions('select', undefined)).toBe(EXERCISE_INSTRUCTIONS.select);
  });

  test('returns a non-empty override verbatim', () => {
    expect(resolveInstructions('select', 'Do this thing.')).toBe('Do this thing.');
  });

  test('suppresses (null) when override is an empty string', () => {
    expect(resolveInstructions('select', '')).toBeNull();
  });

  test('suppresses (null) when override is explicit null', () => {
    expect(resolveInstructions('select', null)).toBeNull();
  });

  test('falls back to the default for a whitespace-only override', () => {
    expect(resolveInstructions('radio-quiz', '   ')).toBe(EXERCISE_INSTRUCTIONS['radio-quiz']);
  });
});

// Maintainer, 2026-10-12: flashcards lost Show answer (the card itself flips) and
// Restart (now the shared Reset, which keeps saved memory). A deck that saves progress
// also says so, and how to clear it.
describe('flashcards instructions', () => {
  test('say to tap the card, name Reset, and drop the old buttons', () => {
    const copy = EXERCISE_INSTRUCTIONS.flashcards;
    expect(copy).toContain('**Reset**');
    expect(copy).not.toMatch(/Show answer|Restart/);
  });

  test('a deck that saves progress adds what that means and how to clear it', () => {
    const copy = resolveInstructions('flashcards', undefined, { savesProgress: true });
    expect(copy).toBe(`${EXERCISE_INSTRUCTIONS.flashcards} ${SAVED_PROGRESS_INSTRUCTIONS}`);
    expect(SAVED_PROGRESS_INSTRUCTIONS).toContain('**Clear saved progress**');
    expect(SAVED_PROGRESS_INSTRUCTIONS).toMatch(/even after \*\*Reset\*\*/);
  });

  test('an author override still wins, saved progress or not', () => {
    expect(resolveInstructions('flashcards', 'Mine.', { savesProgress: true })).toBe('Mine.');
  });

  test("savesProgress reads a deck's options.srs off an unknown config", () => {
    expect(savesProgress({ type: 'flashcards', options: { srs: true } })).toBe(true);
    expect(savesProgress({ type: 'flashcards', options: { srs: false } })).toBe(false);
    expect(savesProgress({ type: 'flashcards', options: {} })).toBe(false);
    expect(savesProgress(null)).toBe(false);
  });

  // Only a deck saves progress. The LO envelope keeps options it does not know, for the
  // engine that owns them, so a stray `srs` (options copied from a deck) can reach any
  // exercise; it must not promise a learner that a select remembers anything.
  test('savesProgress: an exercise that is not a deck never saves progress', () => {
    expect(savesProgress({ type: 'select', options: { srs: true } })).toBe(false);
    expect(savesProgress({ options: { srs: true } })).toBe(false);
  });
});

describe('an exercise set (E57)', () => {
  test('its own instructions show above the tabs', () => {
    expect(resolveSetInstructions('Do both parts.', ['select', 'inline-choice'])).toBe(
      'Do both parts.',
    );
  });

  test('without them, tabs of one engine show that engine default copy (S2)', () => {
    expect(resolveSetInstructions(undefined, ['drag-fill-gaps', 'drag-fill-gaps'])).toBe(
      EXERCISE_INSTRUCTIONS['drag-fill-gaps'],
    );
  });

  test('a set of decks that save progress says so above the tabs', () => {
    expect(
      resolveSetInstructions(undefined, ['flashcards', 'flashcards'], { savesProgress: true }),
    ).toBe(`${EXERCISE_INSTRUCTIONS.flashcards} ${SAVED_PROGRESS_INSTRUCTIONS}`);
  });

  test('tabs of different engines have no default, so the loader must refuse (S2)', () => {
    expect(resolveSetInstructions(undefined, ['select', 'inline-choice'])).toBeNull();
  });

  test('in a tab, only the exercise own instructions show (S3)', () => {
    expect(resolveInstructions('select', undefined, { useDefault: false })).toBeNull();
    expect(resolveInstructions('select', 'Listen first.', { useDefault: false })).toBe(
      'Listen first.',
    );
  });
});
