/**
 * CreditsButton — the footer's "Credits" (E56). A <button>, not a link: it opens the
 * lesson's credits popup and navigates nowhere (rich-text spec §7, as ModalLink).
 * Styled as the footer's licence link (`.footer-licence-link`), with the button's own
 * chrome reset by `.footer-credits` in footer.css.
 *
 * `useModal` throws outside a ModalProvider, as a popup link does: only `App` passes a
 * credits id, and `App` wraps the page in the provider, so that would be a wiring bug.
 *
 * Spec: docs/specs/2026-11-11-footer-credits-design.md §5.
 */
import { resolveLabel } from '@/config/ui-strings';
import { useModal } from '@/lo/rich-text/modal/modal-context';

interface CreditsButtonProps {
  /** The declared modal to open — `lo.json`'s `credits`. */
  modalId: string;
}

export default function CreditsButton({ modalId }: CreditsButtonProps) {
  const { open } = useModal();
  return (
    <button
      type="button"
      className="footer-licence-link footer-credits"
      onClick={() => open(modalId)}
    >
      {resolveLabel('credits')}
    </button>
  );
}
