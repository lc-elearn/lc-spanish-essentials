/**
 * RadioQuizExercise.test.tsx — layout of the answer pills (TODO §D13, 2026-10-08).
 * A question's group of pills wrapped inside each pill at 320 and 375px; the groups
 * are block-level, beside a stem, so they stack while narrow (ChoicePillGroup).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import RadioQuizExercise from './RadioQuizExercise';
import { radioQuizFixtures } from './radio-quiz.fixture';

test("stacks every question's pills while its column is narrow", () => {
  const html = renderToStaticMarkup(<RadioQuizExercise config={radioQuizFixtures[0].config} />);
  const groups = [...html.matchAll(/<div[^>]*class="([^"]*)"[^>]*role="radiogroup"/g)];

  expect(groups.length).toBeGreaterThan(0);
  for (const [, classes] of groups) expect(classes.split(' ')).toContain('choice-pills-group');
});

// 2026-11-18: one long answer turns every question into a vertical list at every width.
test('stacks every question at every width when any answer is long', () => {
  const base = radioQuizFixtures[0].config as {
    content: { questions: { options: string[] }[] };
  };
  const [first, ...rest] = base.content.questions;
  const config = {
    ...base,
    content: {
      ...base.content,
      questions: [{ ...first, options: [...first.options, 'x'.repeat(31)] }, ...rest],
    },
  };
  const html = renderToStaticMarkup(<RadioQuizExercise config={config} />);
  const groups = [...html.matchAll(/<div[^>]*class="([^"]*)"[^>]*role="radiogroup"/g)];

  expect(groups.length).toBeGreaterThan(1);
  for (const [, classes] of groups) expect(classes.split(' ')).toContain('choice-pills-stacked');
});

test("keeps the fixture's short answers as a row from 30rem", () => {
  const html = renderToStaticMarkup(<RadioQuizExercise config={radioQuizFixtures[0].config} />);

  expect(html).not.toContain('choice-pills-stacked');
});
