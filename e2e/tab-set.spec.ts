/**
 * tab-set.spec.ts — the active folder tab joins its panel, in light AND dark
 * (docs/specs/2026-10-07-tabs-block-design.md §4; `TabSet.tsx`).
 *
 * The active tab covers the tab row's bottom rule with a bottom border in its own
 * background colour, so it reads as one shape with the panel beneath. The defect it
 * pins: in dark mode `dark:data-active:border-primary` re-coloured all four sides, and
 * the `dark:` variant (`&:is(.dark *)`) adds a class of specificity, so it beat the
 * plain `data-active:border-b-card` — a primary line ran under the active tab in dark
 * mode only. Measured on the built page because it is the cascade that decides it.
 */
import { expect, test } from '@playwright/test';

import { animationsSettled, exampleReady } from './support';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('the active tab has no line beneath it', async ({ page }) => {
      await page.goto('example.html');
      await exampleReady(page);
      await expect(page.locator('html')).toHaveClass(
        colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
      );
      await animationsSettled(page);

      const activeTabs = page.locator('[role="tab"][aria-selected="true"]:visible');
      await expect(activeTabs.first()).toBeVisible();

      for (const tab of await activeTabs.all()) {
        const { bottom, background } = await tab.evaluate((element) => {
          const style = getComputedStyle(element);
          return { bottom: style.borderBottomColor, background: style.backgroundColor };
        });
        expect(bottom, `${await tab.textContent()}: bottom border matches its background`).toBe(
          background,
        );
      }
    });
  });
}
