import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="glass-panel relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-sm font-extrabold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="tap-target rounded-md px-2 text-muted hover:bg-canvas"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}
