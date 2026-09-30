'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { fmtDate, fmtMac } from '@/lib/format';
import { Field } from '@/components/ui/adm';
import Modal from '@/components/ui/Modal';
import LotInput from './LotInput';
import { useLots } from './hooks';
import { devicePath, type DeviceStage, type DeviceUnit } from './types';

type Form = { bleMac: string; lotCode: string; stage: DeviceStage; shippedTo: string; manufacturedAt: string; note: string; verified: boolean };

function toForm(u: DeviceUnit): Form {
  return {
    bleMac: u.bleMac ? fmtMac(u.bleMac) : '',
    lotCode: u.lotCode,
    stage: u.stage,
    shippedTo: u.shippedTo,
    manufacturedAt: u.manufacturedAt ? fmtDate(u.manufacturedAt) : '',
    note: u.note,
    verified: u.verified,
  };
}

/** 재고 정보 수정(MAC·로트·단계·출고처·제조일·메모·확인 여부). 바뀐 항목만 보낸다. */
export default function DeviceEditModal({ unit, open, onClose, onSaved }: { unit: DeviceUnit; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(() => toForm(unit));
  const [saving, setSaving] = useState(false);
  const { lots } = useLots();

  useEffect(() => {
    if (open) setForm(toForm(unit));
  }, [open, unit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const before = toForm(unit);
    const body: Partial<Form> = {};
    (Object.keys(form) as (keyof Form)[]).forEach((k) => {
      const value = typeof form[k] === 'string' ? (form[k] as string).trim() : form[k];
      if (value !== before[k]) Object.assign(body, { [k]: value });
    });
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await api(devicePath(unit.serial), { method: 'PATCH', body });
      toast.success('저장했습니다');
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
      title={`정보 수정 — ${unit.serial}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="submit" form="device-edit-form" className="adm-btn adm-btn-primary" disabled={saving}>
            저장
          </button>
        </>
      }
    >
      <form id="device-edit-form" className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={submit}>
        <Field label="MAC" hint="12자리 16진수. QR 에 담겨 앱이 BLE 자동 연결에 씁니다. 비우면 삭제됩니다.">
          <input className="adm-input mono" value={form.bleMac} onChange={(e) => setForm({ ...form, bleMac: e.target.value })} placeholder="04:AC:44:11:11:02" />
        </Field>
        <Field label="로트" hint="없는 코드는 새로 만들어집니다.">
          <LotInput lots={lots.map((l) => l.code)} value={form.lotCode} onChange={(lotCode) => setForm({ ...form, lotCode })} />
        </Field>
        <Field label="단계">
          <select className="adm-input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as DeviceStage })}>
            <option value="stock">재고</option>
            <option value="shipped">출고</option>
          </select>
        </Field>
        <Field label="출고처">
          <input className="adm-input" value={form.shippedTo} maxLength={200} onChange={(e) => setForm({ ...form, shippedTo: e.target.value })} />
        </Field>
        <Field label="제조일">
          <input type="date" className="adm-input" value={form.manufacturedAt} onChange={(e) => setForm({ ...form, manufacturedAt: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 sm:mt-6 text-[13px]">
          <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} />
          확인된 SN (재고에 있는 정식 SN)
        </label>
        <Field label="메모" className="sm:col-span-2">
          <textarea className="adm-input" rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
