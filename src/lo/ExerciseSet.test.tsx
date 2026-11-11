/**
 * ExerciseSet.test.tsx — the exercise set's body (E57): one instruction box above a
 * tab row named by the set, each panel its media then its exercise, and a tab's own
 * box only when its exercise wrote one.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5 (S2, S3, S5).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { EXERCISE_INSTRUCTIONS } from '@/exercises/lib/instructions';
import { ExerciseSetBody, type ExerciseSetTabView } from './ExerciseSet';

const TABS: ExerciseSetTabView[] = [
  {
    id: '03-drag-fill-gaps',
    label: 'Part 1',
    type: 'drag-fill-gaps',
    config: {
      type: 'drag-fill-gaps',
      title: 'Part 1',
      content: { items: [{ text: 'Yo [soy].' }] },
    },
  },
  {
    id: '04-inline-choice',
    label: 'Part 2',
    type: 'inline-choice',
    config: {
      type: 'inline-choice',
      title: 'Part 2',
      content: { instructions: 'Listen first, then pick.', items: [{ text: 'a [*b|c]' }] },
    },
    media: { audio: { src: 'audio/lo-00-example/placeholder.m4a', label: 'Listen' } },
  },
];

function render(): string {
  return renderToStaticMarkup(
    <ExerciseSetBody label="Placeholder exercise set" instructions="Do both parts." tabs={TABS} />,
  );
}

test('one box above the tabs, then a tab row named by the set (S2)', () => {
  const html = render();

  expect(html.indexOf('Do both parts.')).toBeGreaterThan(-1);
  expect(html.indexOf('Do both parts.')).toBeLessThan(html.indexOf('role="tablist"'));
  expect(html).toContain('aria-label="Placeholder exercise set"');
  expect(html).toContain('>Part 1<');
  expect(html).toContain('>Part 2<');
});

test('a tab shows a box only when its exercise wrote one (S3)', () => {
  const html = render();

  expect(html).toContain('Listen first, then pick.');
  expect(html).not.toContain(EXERCISE_INSTRUCTIONS['drag-fill-gaps'].slice(0, 30));
});

test("a tab's media comes before its exercise (S5)", () => {
  const html = render();

  expect(html.indexOf('<audio')).toBeGreaterThan(-1);
  expect(html.indexOf('<audio')).toBeLessThan(html.indexOf('Listen first, then pick.'));
});

test('every panel prerenders the honest no-JavaScript line', () => {
  expect(render().split('needs JavaScript').length - 1).toBe(2);
});
