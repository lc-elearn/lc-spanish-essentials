/**
 * section-nav.spec.ts — a header nav link lands its section on the FIRST click
 * (docs/specs/2026-10-06-header-scroll-spy-design.md, "Focus and hash").
 *
 * The defect it pins: the `hashchange` handler in PageLayout focused the section's
 * <h2> while the link's smooth scroll was still travelling. A focus scrolls its element
 * into view, which cut the smooth scroll short and parked the section just inside the
 * bottom of the viewport. A second click, with the hash already set, fired no
 * `hashchange`, so only then did the section reach its scroll margin. The heading must
 * still take focus (spec §5), only without scrolling.
 */
import { expect, test } from '@playwright/test';

import { exampleReady } from './support';

/** Sub-pixel rounding between a section's rect and its computed scroll margin. */
const TOLERANCE_PX = 2;

test('one click on a header link parks its section on its scroll margin and focuses the heading', async ({
  page,
}) => {
  await page.goto('example.html');
  await exampleReady(page);

  const section = page.locator('section#grammar');
  const scrollMargin = await section.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).scrollMarginTop),
  );

  await page.getByRole('banner').getByRole('link', { name: 'Grammar' }).click();

  // Polls until the smooth scroll settles on the margin; a scroll cut short settles
  // elsewhere and never gets there.
  await expect
    .poll(async () =>
      Math.abs(
        (await section.evaluate((element) => element.getBoundingClientRect().top)) - scrollMargin,
      ),
    )
    .toBeLessThanOrEqual(TOLERANCE_PX);
  await expect(page.getByRole('heading', { level: 2, name: 'Grammar' })).toBeFocused();
});
