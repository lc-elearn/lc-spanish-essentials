/**
 * vocabulary-word-bank.spec.ts — the example lesson's word bank (E63, spec §4–5, §8):
 * the self-test drill from the keyboard, and axe with words hidden, in both views and
 * both colour schemes.
 *
 * The course-language button is found by its shape, never by "Hide Spanish": a course
 * runs this suite with its own `languageCode` (TODO, 2026-11-09).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  animationsInside,
  animationsSettled,
  exampleReady,
  expectNoAxeViolations,
  openExercise,
  watchForProblems,
} from './support';

/** The example's vocabulary block: `blocks/02-vocabulary`, so its accordion heading id. */
const VOCABULARY_HEADING = '#block-02-vocabulary-heading';
const FIRST_TERM = 'Placeholder term one';

async function openWordBank(page: Page): Promise<Locator> {
  await page.goto('example.html');
  await exampleReady(page);
  await animationsSettled(page);
  return openExercise(page, VOCABULARY_HEADING);
}

/**
 * Presses a button from the keyboard, then waits for its colour change to finish: a
 * pressed toggle fades to its filled colours (`transition-all`), and axe measuring
 * mid-fade reports a contrast the settled page does not have. The keyboard also keeps
 * the pointer off the button, so axe never measures its hover colour.
 */
async function press(page: Page, bank: Locator, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
  // The bank, not the button: a Reveal button leaves the page when pressed.
  await animationsInside(bank);
}

/** Hide {course language}: the button in "Test yourself" that is not "Hide English". */
const hideTarget = (bank: Locator): Locator =>
  bank
    .getByRole('group', { name: 'Test yourself' })
    .getByRole('button', { name: /^Hide (?!English$)/ });

test('the self-test drill from the keyboard: hide, reveal, focus, switch view', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  const bank = await openWordBank(page);
  const hide = hideTarget(bank);

  await press(page, bank, hide);
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  // Hidden, not gone: an invisible, aria-hidden placeholder keeps the column's width.
  await expect(bank.getByText(FIRST_TERM, { exact: true })).toBeHidden();

  await press(page, bank, bank.getByRole('button', { name: /, word 1$/ }));
  const word = bank.getByText(FIRST_TERM, { exact: true });
  await expect(word).toBeFocused();
  await expect(word).toHaveAttribute('lang', /.+/);

  const alphabetical = bank.getByRole('button', { name: 'Alphabetical' });
  await alphabetical.focus();
  await page.keyboard.press('Space');
  await expect(alphabetical).toHaveAttribute('aria-pressed', 'true');
  // The hide setting survives the switch; what was revealed does not.
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.getByText(FIRST_TERM, { exact: true })).toBeHidden();
  await expect(bank.getByRole('heading', { level: 4, name: 'A', exact: true })).toBeVisible();
  expect(problems).toEqual([]);
});

test('hiding English: revealing a gloss moves focus to it', async ({ page }) => {
  const problems = watchForProblems(page);
  const bank = await openWordBank(page);
  const hideEnglish = bank.getByRole('button', { name: 'Hide English' });

  await press(page, bank, hideEnglish);
  await expect(hideEnglish).toHaveAttribute('aria-pressed', 'true');
  await press(page, bank, bank.getByRole('button', { name: 'Reveal English, word 1' }));
  // The gloss is a `dd`'s only child; the focused span must be inside one.
  const gloss = bank.locator('dd > span:focus');
  await expect(gloss).toBeFocused();
  await expect(gloss).not.toHaveAttribute('lang', /.+/);
  expect(problems).toEqual([]);
});

// An entry may belong to several topics: one word, two rows. The example lesson lists
// "Another placeholder term" under both topics (word 3 and word 4 in the topic view).
test('a word in two topics: Reveal on the second copy focuses that copy', async ({ page }) => {
  const problems = watchForProblems(page);
  const bank = await openWordBank(page);
  const copies = bank.getByText('Another placeholder term', { exact: true });

  await expect(copies).toHaveCount(2);
  await press(page, bank, hideTarget(bank));
  await press(page, bank, bank.getByRole('button', { name: /, word 4$/ }));
  // One word: revealed in both places; focus is on the copy whose button was pressed.
  await expect(copies.nth(1)).toBeFocused();
  await expect(copies.nth(0)).not.toBeFocused();
  await expect(copies.nth(0)).toBeVisible();
  expect(problems).toEqual([]);
});

// Spec §5: a hidden word keeps its space, so the other column does not jump. Found by
// eye in the browser (2026-11-13): hiding the course language moved the glosses ~120px
// left, because the Reveal button is narrower than the words it stands in for.
test('hiding a side does not move the other column, in both views', async ({ page }) => {
  const bank = await openWordBank(page);
  const glossLeft = () =>
    bank
      .locator('dd')
      .first()
      .evaluate((dd) => Math.round(dd.getBoundingClientRect().left));
  const termLeft = () =>
    bank
      .locator('dt')
      .first()
      .evaluate((dt) => Math.round(dt.getBoundingClientRect().right));

  for (const view of ['Semantic', 'Alphabetical']) {
    await press(page, bank, bank.getByRole('button', { name: view }));
    const gloss = await glossLeft();
    const term = await termLeft();

    await press(page, bank, hideTarget(bank));
    expect(await glossLeft()).toBe(gloss);
    await press(page, bank, bank.getByRole('button', { name: 'Hide English' }));
    expect(await termLeft()).toBe(term);
    expect(await glossLeft()).toBe(gloss);
    await press(page, bank, bank.getByRole('button', { name: 'Hide English' }));
  }
});

test('no horizontal scroll at 320px with words hidden, in both views', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const bank = await openWordBank(page);
  const overflow = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });

  await press(page, bank, hideTarget(bank));
  expect(await overflow()).toBeLessThanOrEqual(0);
  await press(page, bank, bank.getByRole('button', { name: 'Alphabetical' }));
  await expect(bank.getByRole('heading', { level: 4, name: 'A', exact: true })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await press(page, bank, bank.getByRole('button', { name: 'Hide English' }));
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('a very long term wraps inside the block instead of pushing the glosses out', async ({
  page,
}) => {
  // Desktop width: the two-column layout. A term as long as Russian lesson 1's
  // "относи́ться/отнести́сь (к + Dat) КАК (…)" once made the term column as wide as the
  // term, and the glosses ran past the accordion's clipped edge.
  await page.setViewportSize({ width: 1000, height: 800 });
  const bank = await openWordBank(page);
  const term = bank.locator('dt span[lang]', { hasText: FIRST_TERM });
  await term.evaluate((span) => {
    span.textContent = 'a very long placeholder term '.repeat(8).trim();
  });

  const spill = await bank.evaluate((root) => {
    const edge = root.getBoundingClientRect().right;
    return Math.max(
      ...[...root.querySelectorAll('dd')].map((dd) => dd.getBoundingClientRect().right - edge),
    );
  });
  expect(spill).toBeLessThanOrEqual(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('no axe violations with words hidden, in both views', async ({ page }) => {
      const problems = watchForProblems(page);
      const bank = await openWordBank(page);
      await press(page, bank, hideTarget(bank));
      await expect(bank.getByRole('button', { name: /, word 1$/ })).toBeVisible();
      await expectNoAxeViolations(page);

      await press(page, bank, bank.getByRole('button', { name: 'Alphabetical' }));
      await expect(bank.getByRole('heading', { level: 4, name: 'A', exact: true })).toBeVisible();
      await expectNoAxeViolations(page);
      expect(problems).toEqual([]);
    });
  });
}
