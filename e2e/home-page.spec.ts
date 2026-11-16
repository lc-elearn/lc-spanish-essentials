/**
 * home-page.spec.ts — what index.html is (TODO §E55): the landing page, or, with
 * `home: "lesson"` in course.json, the course's one lesson. Reads the course's own
 * course.json, so a course runs the half that applies to it; the template, which keeps
 * "landing", runs the first half in CI. The second half is run by setting "lesson" and
 * building (docs/process/2026-11-10-standalone-lesson-plan.md, Task 7).
 */
import { expect, test } from '@playwright/test';

import { readCourseHome } from '../src/config/course-json-disk';
import { frontPageLesson } from '../src/lo/course-lessons';
import { listLoSlugs } from '../src/lo/lo-folders';
import { loSlugsByFolder, sortLoFolders } from '../src/lo/lo-slug';

const FOLDERS = sortLoFolders(listLoSlugs());
const FRONT_LESSON = frontPageLesson(FOLDERS, readCourseHome());

test.describe('home: "landing"', () => {
  test.skip(FRONT_LESSON !== undefined, 'this course opens on its lesson');

  test('index.html lists the lessons', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.getByRole('heading', { level: 2, name: 'Lessons' })).toBeVisible();
    await expect(page.locator('nav[aria-label="Lessons"]')).toBeAttached();
  });
});

test.describe('home: "lesson"', () => {
  test.skip(FRONT_LESSON === undefined, 'this course opens on its list of lessons');
  const folder = FRONT_LESSON ?? '';
  const slug = loSlugsByFolder(FOLDERS).get(folder) ?? '';

  test('index.html is the lesson, with no landing page', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.locator('#root')).toHaveAttribute('data-lo-folder', folder);
    await expect(page.getByRole('heading', { level: 2, name: 'Lessons' })).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Lessons"]')).toHaveCount(0);
  });

  test("the lesson's own page is still built", async ({ page }) => {
    const response = await page.goto(`${slug}.html`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).toHaveAttribute('data-lo-folder', folder);
  });

  test('the course link in the header opens the same lesson', async ({ page }) => {
    await page.goto(`${slug}.html`);
    await page.locator('a.site-header-brand').click();
    await expect(page).toHaveURL(/\/(index\.html)?$/);
    await expect(page.locator('#root')).toHaveAttribute('data-lo-folder', folder);
  });
});
