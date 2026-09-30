'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** 공통 모달: Esc·바깥 클릭으로 닫힘, 본문 스크롤. */
export default function Modal({
  open, title, onClose, children, footer, width = 560,
}: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // 확인·입력 창(DialogHost)이 위에 떠 있으면 Esc 는 그 창만 닫는다.
      if (e.key === 'Escape' && !document.querySelector('[role="alertdialog"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 bg-neutral/55" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="adm-card w-full max-h-[92vh] flex flex-col shadow-xl"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-base-300">
          <h3 className="text-[15px] font-bold truncate">{title}</h3>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm !px-1.5" onClick={onClose} aria-label="닫기">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-base-300">{footer}</div>}
      </div>
    </div>
  );
}
