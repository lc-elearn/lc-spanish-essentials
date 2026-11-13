/**
 * TabSet.test.tsx — the shared tab UI (E57): a named tab row, every panel in the
 * prerendered page, the inactive ones hidden.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TabSet } from './TabSet';

const TABS = [
  { key: 'a', label: 'Part 1', panel: <p>First panel</p> },
  { key: 'b', label: 'Part 2', panel: <p>Second panel</p> },
];

test('names the tab row and renders one tab per entry', () => {
  const html = renderToStaticMarkup(<TabSet label="Reconstruct the text" tabs={TABS} />);

  expect(html).toContain('role="tablist"');
  expect(html).toContain('aria-label="Reconstruct the text"');
  expect(html.split('role="tab"').length - 1).toBe(2);
  expect(html).toContain('>Part 1<');
  expect(html).toContain('>Part 2<');
});

test('prerenders every panel, the inactive one hidden', () => {
  const html = renderToStaticMarkup(<TabSet label="Parts" tabs={TABS} />);

  expect(html).toContain('<p>First panel</p>');
  expect(html).toContain('<p>Second panel</p>');
  expect(html.split('role="tabpanel"').length - 1).toBe(2);
  expect(html).toMatch(/hidden/);
});
