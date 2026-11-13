/**
 * Tests for Footer (spec §1/§5, and §D · D1 for the colophon rewrite).
 *
 * Two load-bearing assertions:
 *
 * 1. The §5 rule: NO heading element anywhere inside the footer. A decorative <h2>
 *    there was a french-lo-1 mistake that broke strict heading-outline checks, and it
 *    is deliberately not repeated. Guard h would catch a stray one across all 26 of
 *    its rendered documents, but this is the local, fast statement of the rule.
 *
 * 2. NO `href="#"` in the rendered output. This is the regression test for the actual
 *    shipped defect: Footer.tsx carried a FOOTER_LINKS array with Accessibility and
 *    Privacy both pointing at `'#'`. `footer.config.ts` now makes that value fail the
 *    build, and this proves the rendered markup agrees — a schema and a component can
 *    disagree, so both ends are asserted.
 */
import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModalProvider } from '@/lo/rich-text/modal/ModalProvider';
import Footer from './Footer';

describe('Footer', () => {
  test('renders exactly one footer landmark', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect((html.match(/<footer/g) ?? []).length).toBe(1);
  });

  test('contains NO heading element (§5 — no h1–h6 inside the footer)', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toMatch(/<h[1-6][\s/>]/);
  });

  test('contains NO dead link — the defect this rewrite fixes', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toMatch(/href="#"/);
  });

  test('contains no in-page fragment href at all', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toMatch(/href="#/);
  });

  // The placeholder copy was user-visible on every page of a live course. A learner
  // read "real links land in a later Phase C part". Asserted gone so it cannot return.
  test('ships no internal build chatter as user-visible copy', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toMatch(/placeholder/i);
    expect(html).not.toMatch(/Phase [A-Z]/);
  });

  test('renders a copyright line carrying the current year', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toMatch(/©|&copy;/);
    expect(html).toContain(String(new Date().getFullYear()));
  });

  // Not a <nav>: spec §17 allows exactly one primary nav landmark per page and the
  // header already owns it. A second one here would fail guard h on both pages.
  test('is not a nav landmark — the header owns the only one', () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toMatch(/<nav/);
  });
});

// The lesson's Credits button (E56, docs/specs/2026-11-11-footer-credits-design.md §5):
// the one piece of the footer that comes from the lesson, not footer.config.ts.
describe('Footer credits (E56)', () => {
  const MODALS = { credits: { id: 'credits', title: 'Credits', content: [] } };
  const BUTTON =
    '<button type="button" class="footer-licence-link footer-credits">Credits</button>';
  const withCredits = () =>
    renderToStaticMarkup(
      <ModalProvider modals={MODALS}>
        <Footer credits="credits" />
      </ModalProvider>,
    );

  test('without credits there is no Credits button', () => {
    expect(renderToStaticMarkup(<Footer />)).not.toMatch(/Credits/);
  });

  test('with credits, the © line ends with a hidden separator and the button', () => {
    expect(withCredits()).toContain(
      `University of Cambridge<span aria-hidden="true"> · </span>${BUTTON}</p>`,
    );
  });

  test('the footer still holds no heading and no dead link', () => {
    const html = withCredits();
    expect(html).not.toMatch(/<h[1-6][\s/>]/);
    expect(html).not.toMatch(/href="#/);
  });

  test('with no © holder the line holds the button alone', async () => {
    vi.resetModules();
    vi.doMock('@/config/footer.config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/config/footer.config')>();
      return { footerConfig: { ...actual.footerConfig, copyrightHolder: undefined } };
    });
    const { default: BareFooter } = await import('./Footer');
    const { ModalProvider: Provider } = await import('@/lo/rich-text/modal/ModalProvider');
    const html = renderToStaticMarkup(
      <Provider modals={MODALS}>
        <BareFooter credits="credits" />
      </Provider>,
    );
    vi.doUnmock('@/config/footer.config');
    expect(html).toContain(`<p class="footer-copyright">${BUTTON}</p>`);
    expect(html).not.toMatch(/©/);
  });
});
