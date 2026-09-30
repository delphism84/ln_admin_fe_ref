'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { fmtDate, fmtNumber } from '@/lib/format';
import { Field, PageTitle } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { useLots } from '@/components/devices/hooks';
import type { Lot, LotStats } from '@/components/devices/types';

/** 표의 한 줄: 로트 또는 맨 아래 "로트 미지정" 합계 */
type Row = LotStats & { code: string; lot: Lot | null };

type Form = { code: string; model: string; manufacturedAt: string; note: string };
const EMPTY_FORM: Form = { code: '', model: '', manufacturedAt: '', note: '' };

/** editing: null = 닫힘, 'new' = 추가, Lot = 수정 */
type Editing = null | 'new' | Lot;

function LotModal({ editing, onClose, onSaved }: { editing: Exclude<Editing, null>; onClose: () => void; onSaved: () => void }) {
  const isNew = editing === 'new';
  const [form, setForm] = useState<Form>(() =>
    isNew ? EMPTY_FORM : { code: editing.code, model: editing.model, manufacturedAt: editing.manufacturedAt ? fmtDate(editing.manufacturedAt) : '', note: editing.note },
  );
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fields = { model: form.model.trim(), manufacturedAt: form.manufacturedAt, note: form.note.trim() };
      if (isNew) await api('/lots', { body: { code: form.code.trim(), ...fields } });
      else await api(`/lots/${encodeURIComponent(editing.code)}`, { method: 'PATCH', body: fields });
      toast.success(isNew ? '로트를 추가했습니다' : '로트를 수정했습니다');
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
      open
      title={isNew ? '로트 추가' : `로트 수정 — ${editing.code}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="submit" form="lot-form" className="adm-btn adm-btn-primary" disabled={saving || (isNew && !form.code.trim())}>
            {isNew ? '추가' : '저장'}
          </button>
        </>
      }
    >
      <form id="lot-form" className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={submit}>
        <Field label="로트 코드" hint={isNew ? '영문·숫자·.-_ 1~40자' : '코드는 바꿀 수 없습니다.'} className="sm:col-span-2">
          <input
            className="adm-input mono"
            value={form.code}
            maxLength={40}
            disabled={!isNew}
            required
            autoFocus={isNew}
            placeholder="LOT-2609A"
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="모델">
          <input className="adm-input mono" value={form.model} maxLength={20} placeholder="C21" onChange={(e) => setForm({ ...form, model: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="제조일">
          <input type="date" className="adm-input" value={form.manufacturedAt} onChange={(e) => setForm({ ...form, manufacturedAt: e.target.value })} />
        </Field>
        <Field label="메모" className="sm:col-span-2">
          <textarea className="adm-input" rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

export default function LotsPage() {
  const { can } = useAuth();
  const canWrite = can('devices.write');
  const canDelete = can('devices.delete');
  const { lots, unassigned, loading, error, reload } = useLots();
  const [editing, setEditing] = useState<Editing>(null);

  const onDelete = async (lot: Lot) => {
    const ok = await dialog.confirm(`로트 ${lot.code} 를 삭제합니다. 센서가 남아 있는 로트는 삭제할 수 없습니다.`, { title: '로트 삭제', danger: true, okText: '삭제' });
    if (!ok) return;
    try {
      await api(`/lots/${encodeURIComponent(lot.code)}`, { method: 'DELETE' });
      toast.success('로트를 삭제했습니다');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const rows: Row[] = [...lots.map((l) => ({ ...l, lot: l })), { ...unassigned, code: '', lot: null }];
  const lotQuery = (r: Row) => encodeURIComponent(r.lot ? r.code : '-');
  const count = (n: number, tone = '') => <span className={n > 0 ? tone : 'text-base-content/45'}>{fmtNumber(n)}</span>;

  const columns: Column<Row>[] = [
    {
      key: 'code',
      title: '로트 코드',
      render: (r) => (r.lot ? <span className="mono font-semibold">{r.code}</span> : <span className="text-base-content/65">로트 미지정</span>),
    },
    { key: 'model', title: '모델', render: (r) => r.lot?.model || '—' },
    { key: 'manufacturedAt', title: '제조일', render: (r) => (r.lot ? fmtDate(r.lot.manufacturedAt) : '—') },
    {
      key: 'total',
      title: '전체',
      num: true,
      render: (r) => (
        <Link href={`/devices?lot=${lotQuery(r)}`} prefetch={false} className="font-semibold text-primary hover:underline" aria-label={`${r.lot ? r.code : '로트 미지정'} 기기 ${r.total}건 보기`}>
          {fmtNumber(r.total)}
        </Link>
      ),
    },
    { key: 'registered', title: '앱 등록', num: true, render: (r) => count(r.registered) },
    { key: 'active', title: '사용 중', num: true, render: (r) => count(r.active, 'text-success font-semibold') },
    { key: 'shipped', title: '출고', num: true, render: (r) => count(r.shipped) },
    { key: 'blocked', title: '차단', num: true, render: (r) => count(r.blocked, 'text-error font-semibold') },
    { key: 'noMac', title: 'MAC 없음', num: true, render: (r) => count(r.noMac, 'text-warning font-semibold') },
    {
      key: 'note',
      title: '메모',
      render: (r) => <span className="block max-w-[260px] truncate" title={r.lot?.note}>{r.lot?.note || '—'}</span>,
    },
    {
      key: 'actions',
      title: '',
      render: (r) => {
        const lot = r.lot;
        if (!lot) return null;
        return (
          <span className="inline-flex items-center gap-1">
            <Link href={`/devices/qr?lot=${lotQuery(r)}`} prefetch={false} className="adm-btn adm-btn-sm">
              <QrCode size={13} /> QR
            </Link>
            {canWrite && (
              <button type="button" className="adm-btn adm-btn-sm !px-1.5" onClick={() => setEditing(lot)} aria-label={`${lot.code} 수정`} title="수정">
                <Pencil size={13} />
              </button>
            )}
            {canDelete && (
              <button type="button" className="adm-btn adm-btn-sm !px-1.5 text-error" onClick={() => onDelete(lot)} aria-label={`${lot.code} 삭제`} title="삭제">
                <Trash2 size={13} />
              </button>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageTitle
        title="로트"
        desc="생산 로트별 센서 수와 등록 현황입니다. SN 등록·가져오기에서 쓴 로트 코드는 자동으로 만들어집니다."
        right={
          canWrite && (
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => setEditing('new')}>
              <Plus size={15} /> 로트 추가
            </button>
          )
        }
      />
      <div className="adm-card">
        <DataTable<Row> columns={columns} rows={error || (loading && lots.length === 0) ? [] : rows} rowKey={(r) => r.code || '(unassigned)'} loading={loading} error={error} />
      </div>
      {editing && <LotModal key={editing === 'new' ? 'new' : editing.code} editing={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}
