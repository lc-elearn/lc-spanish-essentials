/**
 * footer-credits.spec.ts — the footer's Credits button on the example lesson (TODO §E56,
 * docs/specs/2026-11-11-footer-credits-design.md §5, §7). The button opens the lesson's
 * credits popup through the page's one dialog; Escape closes it and focus goes back.
 */
import { expect, test, type Page } from '@playwright/test';

import { readCourseHome } from '../src/config/course-json-disk';
import { animationsInside, exampleReady } from './support';

/** A phone: the narrowest width the course supports, at a common short height. */
const PHONE = { width: 320, height: 568 };

function creditsButton(page: Page) {
  return page.getByRole('contentinfo').getByRole('button', { name: 'Credits' });
}

async function openCredits(page: Page) {
  await creditsButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'Credits' });
  await expect(dialog).toBeVisible();
  await animationsInside(dialog);
  return dialog;
}

// Opened from the keyboard: focus return is for keyboard users, and WebKit, like Safari,
// does not focus a button on a mouse click, so a click leaves no focus to return.
test('Credits opens the credits popup, and Escape returns focus to it', async ({ page }) => {
  await page.goto('example.html');
  await exampleReady(page);
  await creditsButton(page).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Credits' });
  await expect(dialog).toBeVisible();
  await animationsInside(dialog);
  await expect(dialog.getByRole('heading', { level: 3, name: 'Team' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(creditsButton(page)).toBeFocused();
});

test('on a phone the popup stays on screen and its last line can be reached', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('example.html');
  await exampleReady(page);
  const dialog = await openCredits(page);
  const box = await dialog.boundingBox();
  if (box === null) throw new Error('the dialog has no box');
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
  const last = dialog.getByText('© University of Cambridge');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test('the landing page has no Credits button', async ({ page }) => {
  test.skip(readCourseHome() === 'lesson', 'this course opens on its lesson');
  await page.goto('index.html');
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(creditsButton(page)).toHaveCount(0);
});
