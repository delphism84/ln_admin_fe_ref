'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Field } from '@/components/ui/adm';
import LotInput from './LotInput';
import { devicePath, type CreateResult } from './types';

const EMPTY = { serial: '', bleMac: '', lotCode: '', manufacturedAt: '', note: '' };

/** SN 1건 등록. 로트·제조일은 다음 등록을 위해 남겨 둔다(같은 로트를 이어서 넣는 일이 많다). */
export default function SingleRegisterForm({ lots }: { lots: string[] }) {
  const [form, setForm] = useState(EMPTY);
  const [strict, setStrict] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<CreateResult[]>([]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api<CreateResult>('/devices', {
        body: {
          serial: form.serial.trim().toUpperCase(),
          bleMac: form.bleMac.trim() || undefined,
          lotCode: form.lotCode.trim() || undefined,
          manufacturedAt: form.manufacturedAt || undefined,
          note: form.note.trim() || undefined,
          strict,
        },
      });
      toast.success(r.result === 'upgraded' ? '미확인 SN 을 확인 처리했습니다' : 'SN 을 등록했습니다');
      setDone((list) => [r, ...list].slice(0, 20));
      setForm((f) => ({ ...f, serial: '', bleMac: '', note: '' }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <form className="adm-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start" onSubmit={submit}>
        <Field label="S/N" hint="예: C21Z00101 (모델 C21 + 연도 코드 Z + 5자리)">
          <input className="adm-input mono" value={form.serial} onChange={set('serial')} maxLength={40} required autoFocus placeholder="C21Z00101" />
        </Field>
        <Field label="MAC (선택)" hint="없으면 QR 에 SN 만 담겨 BLE 자동 연결이 되지 않습니다.">
          <input className="adm-input mono" value={form.bleMac} onChange={set('bleMac')} placeholder="04:AC:44:11:11:02" />
        </Field>
        <Field label="로트 (선택)" hint="없는 코드는 새로 만들어집니다.">
          <LotInput lots={lots} value={form.lotCode} onChange={(lotCode) => setForm((f) => ({ ...f, lotCode }))} />
        </Field>
        <Field label="제조일 (선택)">
          <input type="date" className="adm-input" value={form.manufacturedAt} onChange={set('manufacturedAt')} />
        </Field>
        <Field label="메모" className="sm:col-span-2">
          <textarea className="adm-input" rows={2} maxLength={500} value={form.note} onChange={set('note')} />
        </Field>
        <label className="sm:col-span-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
          형식이 규칙과 다르면 거절
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={saving || !form.serial.trim()}>
            등록
          </button>
        </div>
      </form>

      <div className="adm-card p-4">
        <h2 className="text-[13px] font-bold mb-2">이번에 등록한 SN</h2>
        {done.length === 0 ? (
          <p className="text-base-content/55">아직 없습니다.</p>
        ) : (
          <ul className="grid gap-1.5">
            {done.map((r) => (
              <li key={r.serial} className="flex flex-wrap items-center gap-2 text-[13px]">
                <CheckCircle2 size={15} className="text-success shrink-0" />
                <Link href={devicePath(r.serial)} prefetch={false} className="mono font-semibold text-primary hover:underline">
                  {r.serial}
                </Link>
                <span className="text-base-content/65">
                  {r.result === 'upgraded' ? '앱이 먼저 등록한 미확인 SN 을 확인 처리했습니다' : '새로 등록했습니다'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
