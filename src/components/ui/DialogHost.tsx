'use client';

import { useEffect, useRef, useState } from 'react';
import { settleDialog, subscribeDialogs, type DialogRequest } from '@/lib/dialog';
import { subscribeToasts, type ToastItem } from '@/lib/toast';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

/** 앱에 한 번만 두는 호스트: lib/dialog 의 확인·입력 창과 lib/toast 의 알림을 그린다. */
export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [text, setText] = useState('');
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cur = queue[0];

  useEffect(() => subscribeDialogs(setQueue), []);
  useEffect(() => subscribeToasts(setToasts), []);

  useEffect(() => {
    if (!cur) return;
    setText(cur.defaultValue || '');
    const t = window.setTimeout(() => (cur.kind === 'prompt' ? inputRef.current?.focus() : okRef.current?.focus()), 30);
    return () => window.clearTimeout(t);
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => cur && settleDialog(cur.id, cur.kind === 'confirm' ? false : cur.kind === 'prompt' ? null : undefined);
  const okDisabled = !!cur && cur.kind === 'prompt' && !!cur.requireText && text.trim() !== cur.requireText;
  const ok = () => {
    if (!cur || okDisabled) return;
    settleDialog(cur.id, cur.kind === 'confirm' ? true : cur.kind === 'prompt' ? text : undefined);
  };

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {cur && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-3 bg-neutral/55" onMouseDown={cancel}>
          <div role="alertdialog" aria-modal="true" className="adm-card w-full max-w-[420px] p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {cur.danger ? <AlertTriangle className="text-error shrink-0 mt-0.5" size={20} /> : <Info className="text-primary shrink-0 mt-0.5" size={20} />}
              <div className="min-w-0 flex-1">
                {cur.title && <div className="text-[15px] font-bold mb-1">{cur.title}</div>}
                <div className="text-[13.5px] leading-relaxed whitespace-pre-line break-words">{cur.message}</div>
                {cur.kind === 'prompt' &&
                  (cur.multiline ? (
                    <textarea ref={inputRef} className="adm-input mt-3" rows={3} value={text} placeholder={cur.placeholder} onChange={(e) => setText(e.target.value)} />
                  ) : (
                    <input
                      ref={inputRef}
                      className="adm-input mt-3"
                      value={text}
                      placeholder={cur.placeholder}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && ok()}
                    />
                  ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {cur.kind !== 'alert' && (
                <button type="button" className="adm-btn" onClick={cancel}>
                  {cur.cancelText || '취소'}
                </button>
              )}
              <button ref={okRef} type="button" className={`adm-btn ${cur.danger ? 'adm-btn-danger' : 'adm-btn-primary'}`} disabled={okDisabled} onClick={ok}>
                {cur.okText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="no-print fixed top-3 right-3 z-[80] flex flex-col gap-2 w-[min(360px,calc(100vw-24px))]" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="adm-card px-3.5 py-2.5 flex items-start gap-2.5 shadow-lg">
            {t.kind === 'success' ? (
              <CheckCircle2 size={17} className="text-success shrink-0 mt-0.5" />
            ) : t.kind === 'error' ? (
              <XCircle size={17} className="text-error shrink-0 mt-0.5" />
            ) : (
              <Info size={17} className="text-info shrink-0 mt-0.5" />
            )}
            <span className="text-[13px] leading-snug break-words min-w-0">{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
