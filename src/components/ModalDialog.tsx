import type { ReactNode } from "react";

export default function ModalDialog({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/35 px-6 py-8 backdrop-blur-[1px]">
      <div className="flex max-h-full min-h-0 w-full max-w-2xl flex-col border border-line bg-paper shadow-active">
        <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink">{title}</h2>
          <button className="menu-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-line bg-panel px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
