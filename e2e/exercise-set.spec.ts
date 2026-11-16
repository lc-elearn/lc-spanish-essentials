/**
 * exercise-set.spec.ts — the example lesson's exercise set (E57): tabs labelled by
 * their exercises, Part 2's own box and audio, answers that survive a tab switch, the
 * dropdown below 48rem, and no axe violations with the set open.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5, §7.
 */
import { expect, test } from '@playwright/test';
import {
  EXERCISE_HEADINGS,
  exampleReady,
  expectNoAxeViolations,
  openExercise,
  watchForProblems,
} from './support';

const SET_NAME = 'Placeholder exercise set';

test.beforeEach(async ({ page }) => {
  await page.goto('example.html');
  await exampleReady(page);
});

test('the tabs are the exercises, and Part 2 has its own box and audio', async ({ page }) => {
  const problems = watchForProblems(page);
  const set = await openExercise(page, EXERCISE_HEADINGS.set);
  const row = set.getByRole('tablist', { name: SET_NAME });

  await expect(row.getByRole('tab')).toHaveText(['Part 1', 'Part 2']);
  // One box above the tabs (the set's), none inside Part 1 (spec S2, S3). Part 2's own
  // box is in a hidden panel, so out of the accessibility tree until its tab opens.
  await expect(set.getByRole('note')).toHaveCount(1);
  await expect(set.getByRole('tabpanel', { name: 'Part 1' }).getByRole('note')).toHaveCount(0);
  await row.getByRole('tab', { name: 'Part 2' }).click();
  const part2 = set.getByRole('tabpanel', { name: 'Part 2' });
  await expect(part2.locator('audio')).toBeAttached();
  await expect(part2.getByRole('note')).toContainText('Play the placeholder clip');
  expect(problems).toEqual([]);
});

test('an answer survives a switch to the other tab and back', async ({ page }) => {
  const set = await openExercise(page, EXERCISE_HEADINGS.set);
  const row = set.getByRole('tablist', { name: SET_NAME });
  await row.getByRole('tab', { name: 'Part 2' }).click();
  const pick = set.getByRole('tabpanel', { name: 'Part 2' }).getByRole('radio', { name: 'días' });

  await pick.click();
  await expect(pick).toBeChecked();
  // Switch by keyboard (←/→ activate on focus). A click on Part 1 here, after the pick
  // scrolled the row up under the sticky header, sometimes landed on the page instead
  // in Firefox (about 1 run in 10): the page scrolled between Playwright's hit test and
  // the click, and focus fell to <body>.
  const part2Tab = row.getByRole('tab', { name: 'Part 2' });
  await part2Tab.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(row.getByRole('tab', { name: 'Part 1' })).toHaveAttribute('aria-selected', 'true');
  await expect(pick).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(part2Tab).toHaveAttribute('aria-selected', 'true');
  await expect(pick).toBeChecked();
});

test('below 48rem a dropdown stands in for the tab row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const set = await openExercise(page, EXERCISE_HEADINGS.set);

  await expect(set.getByRole('tablist', { name: SET_NAME })).toBeHidden();
  await set.getByRole('combobox', { name: SET_NAME }).click();
  await page.getByRole('option', { name: 'Part 2' }).click();
  await expect(set.getByRole('tabpanel', { name: 'Part 2' })).toBeVisible();
});

test('no axe violations with the set open', async ({ page }) => {
  await openExercise(page, EXERCISE_HEADINGS.set);
  await expectNoAxeViolations(page);
});
