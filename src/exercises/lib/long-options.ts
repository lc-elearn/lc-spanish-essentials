/**
 * long-options.ts — when an exercise's answers are too long for a row (2026-11-18).
 * Sentence-length answers in the connected row each wrapped onto two lines inside
 * their segment (Russian lesson 1's reading). The engine checks every question at
 * once and passes `stacked` to each ChoicePillGroup, so one exercise never mixes rows
 * and lists. 30 characters keeps every showcase fixture a row (longest: 24).
 */

/** An answer longer than this many characters stacks its exercise's groups. */
export const LONG_OPTION_CHARS = 30;

/** True when any option in any of the groups is longer than `LONG_OPTION_CHARS`. */
export function hasLongOption(optionGroups: readonly (readonly string[])[]): boolean {
  return optionGroups.some((options) =>
    options.some((option) => option.length > LONG_OPTION_CHARS),
  );
}
