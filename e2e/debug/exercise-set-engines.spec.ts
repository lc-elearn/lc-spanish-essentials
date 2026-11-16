/**
 * exercise-set-engines.spec.ts — every engine works in a tab of an exercise set (E57,
 * spec S6), on the exercise showcase's "every engine in a tab" card. A hidden tab panel
 * has no size, so an engine that measures its layout must measure again when its tab
 * shows; line-match does, through ResizeObserver, and the second test proves it.
 */
import { expect, test } from '@playwright/test';
import { watchForProblems } from '../support';
import { card, openShowcase } from './debug-support';

const SET = 'exercise-set-every-engine';

test('every engine renders, sized and without error, when its tab opens', async ({ page }) => {
  const problems = watchForProblems(page);
  await openShowcase(page);
  const set = card(page, SET);
  const tabs = set.getByRole('tab');
  await expect(tabs).toHaveCount(15);

  for (const tab of await tabs.all()) {
    const name = (await tab.textContent()) ?? '';
    await tab.click();
    const panel = set.getByRole('tabpanel', { name, exact: true });
    await expect(panel, name).toBeVisible();
    await expect(panel.getByText('Loading…', { exact: true }), name).toHaveCount(0);
    await expect(panel.getByRole('alert'), name).toHaveCount(0);
    const box = await panel.boundingBox();
    expect(box?.height ?? 0, `${name} has a height`).toBeGreaterThan(100);
  }
  expect(problems).toEqual([]);
});

test('line-match measures its stage once its tab shows', async ({ page }) => {
  await openShowcase(page);
  const set = card(page, SET);
  await set.getByRole('tab', { name: 'line-match', exact: true }).click();
  const panel = set.getByRole('tabpanel', { name: 'line-match', exact: true });

  // Desktop layout (≥980px): pick a picture's dot, then a word's, and a connector is drawn
  // between them. Measured while the panel was hidden (0×0), it would collapse to a point.
  await panel.getByRole('button', { name: /^Picture 1\b/ }).click();
  await panel
    .getByRole('button', { name: /^Word / })
    .first()
    .click();
  const connector = panel.locator('svg.pointer-events-none path').last();
  await expect(connector).toBeAttached();
  const line = await connector.boundingBox();
  const area = await panel.boundingBox();
  if (line === null || area === null) throw new Error('the connector or the panel has no box');

  expect(line.width, 'the connector spans the gap between columns').toBeGreaterThan(10);
  expect(line.x).toBeGreaterThanOrEqual(area.x);
  expect(line.x + line.width).toBeLessThanOrEqual(area.x + area.width);
  expect(line.y).toBeGreaterThanOrEqual(area.y);
  expect(line.y + line.height).toBeLessThanOrEqual(area.y + area.height);
});
