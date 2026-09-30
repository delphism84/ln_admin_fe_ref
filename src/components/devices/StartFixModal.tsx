'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/format';
import { Field } from '@/components/ui/adm';
import Modal from '@/components/ui/Modal';
import { devicePath } from './types';

/** 시작시각 정정. 만료 시각은 시작 + 유효기간으로 따라 바뀐다. 입력은 한국시간. */
export default function StartFixModal({
  serial, startAt, validityDays, open, onClose, onSaved,
}: { serial: string; startAt: string | null; validityDays: number; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(toLocalInput(startAt));
    setNote('');
  }, [open, startAt]);

  const iso = fromLocalInput(value);
  const newEnd = iso ? new Date(new Date(iso).getTime() + validityDays * 86400000) : null;
  const inFuture = !!iso && new Date(iso).getTime() > Date.now();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!iso || inFuture) return;
    setSaving(true);
    try {
      await api(`${devicePath(serial)}/start`, { body: { startAt: iso, note: note.trim() } });
      toast.success('시작시각을 정정했습니다');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`시작시각 정정 — ${serial}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="submit" form="start-fix-form" className="adm-btn adm-btn-primary" disabled={saving || !iso || inFuture}>
            정정
          </button>
        </>
      }
    >
      <form id="start-fix-form" className="grid gap-3" onSubmit={submit}>
        <Field label="새 시작시각 (한국시간)" hint={`현재: ${fmtDateTime(startAt)}`}>
          <input type="datetime-local" className="adm-input" value={value} max={toLocalInput(new Date())} onChange={(e) => setValue(e.target.value)} required />
        </Field>
        <div className="rounded-lg bg-base-200 px-3 py-2 text-[13px]" aria-live="polite">
          {inFuture ? (
            <span className="text-error font-medium">시작시각은 미래일 수 없습니다.</span>
          ) : (
            <>
              새 만료 시각: <b className="tabular-nums">{fmtDateTime(newEnd)}</b>
              <span className="text-base-content/60"> (시작 + {validityDays}일)</span>
            </>
          )}
        </div>
        <Field label="메모 (선택)">
          <input className="adm-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="정정 사유" />
        </Field>
      </form>
    </Modal>
  );
}
