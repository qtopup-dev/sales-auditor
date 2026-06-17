import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose?: () => void; // undefined when save in-flight — blocks close (CLAUDE.md Rule 10)
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

// Shared modal wrapper per UI-SPEC.md §Modal
// Escape key + backdrop click close are blocked when onClose is undefined (during save)
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  // Escape key listener
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50"
      onClick={() => onClose?.()}
    >
      {/* Card — stopPropagation prevents overlay click from closing when clicking inside card */}
      <div
        className="bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Title row */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={!onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-0"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">{children}</div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6 pt-4 border-t border-gray-200">
          {footer}
        </div>
      </div>
    </div>
  );
}
