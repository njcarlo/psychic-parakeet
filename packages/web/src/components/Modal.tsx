import type { ReactNode } from 'react';

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-coastal-900/35 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-6 shadow-soft">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-coastal-600">CleanOps</p>
            <h2 className="font-display text-2xl font-bold text-coastal-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-coastal-100 px-3 py-1 text-sm font-bold text-coastal-700 hover:bg-coastal-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
