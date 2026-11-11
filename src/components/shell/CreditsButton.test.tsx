// @vitest-environment happy-dom
/**
 * CreditsButton (E56): the footer's "Credits" asks the page's one ModalProvider to open
 * the lesson's credits popup. The context is stubbed, so this is about the button; the
 * real dialog is the browser test (e2e/footer-credits.spec.ts).
 * Spec: docs/specs/2026-11-11-footer-credits-design.md §5.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ModalContext, type ModalContextValue } from '@/lo/rich-text/modal/modal-context';
import CreditsButton from './CreditsButton';

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(open: (id: string) => void): HTMLButtonElement {
  const value: ModalContextValue = { modals: {}, openId: null, open, close: vi.fn() };
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <ModalContext.Provider value={value}>
        <CreditsButton modalId="credits" />
      </ModalContext.Provider>,
    ),
  );
  const button = container.querySelector('button');
  if (button === null) throw new Error('no button rendered');
  return button;
}

describe('CreditsButton', () => {
  test('is a plain button labelled "Credits" from ui-strings', () => {
    const button = mount(vi.fn());
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent).toBe('Credits');
  });

  test('a click opens the named popup', () => {
    const open = vi.fn();
    const button = mount(open);
    act(() => button.click());
    expect(open).toHaveBeenCalledWith('credits');
  });

  test('outside a ModalProvider it fails loudly, as a popup link does', () => {
    expect(() => renderToStaticMarkup(<CreditsButton modalId="credits" />)).toThrow(
      /ModalProvider/,
    );
  });
});
