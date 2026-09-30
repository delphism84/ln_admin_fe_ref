'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ErrorBox, Field, Panel } from '@/components/ui/adm';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { fmtNumber } from '@/lib/format';

const CONFIRM_PHRASE = 'RESET ALL DATA';

/** POST /system/reset 의 deleted */
type ResetCounts = { users: number; devices: number; glucose: number; events: number; sensors: number; alarms: number; settings: number };

const COUNT_LABELS: { key: keyof ResetCounts; label: string }[] = [
  { key: 'users', label: '회원' },
  { key: 'devices', label: '센서 등록' },
  { key: 'glucose', label: '혈당' },
  { key: 'events', label: '이벤트' },
  { key: 'sensors', label: '센서 기록' },
  { key: 'alarms', label: '알람' },
  { key: 'settings', label: '앱 설정' },
];

/** 위험 구역: 전체 데이터 초기화. 본인 비밀번호와 확인 문구를 모두 넣어야 실행된다. */
export default function ResetPanel() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResetCounts | null>(null);

  const ready = password.length > 0 && phrase === CONFIRM_PHRASE;

  function show() {
    setPassword('');
    setPhrase('');
    setError('');
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setPhrase('');
  }

  async function run() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; deleted: ResetCounts }>('/system/reset', { body: { password, confirm: CONFIRM_PHRASE } });
      setResult(r.deleted);
      setOpen(false);
      setPassword('');
      setPhrase('');
      toast.success('전체 데이터를 초기화했습니다.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={<span className="text-error">위험 구역</span>} className="border-error/40" bodyClass="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 text-[13px]">
          <p className="font-bold">전체 데이터 초기화</p>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-base-content/75 list-disc pl-4">
            <li>
              <span className="font-semibold text-error">삭제됨</span> — 회원, 센서 등록(앱 등록·소유권·등록 이력), 혈당, 이벤트, 알람, 앱 설정
            </li>
            <li>
              <span className="font-semibold text-success">유지됨</span> — 관리자 계정, 감사 로그, 시스템 설정, 센서 재고(SN 대장)
            </li>
            <li>앱에서 등록되어 재고 확인이 안 된(미확인) SN 은 재고에서도 지워지고, 나머지 재고는 미등록 상태로 돌아갑니다.</li>
            <li>삭제된 데이터는 복구할 수 없습니다. 모든 회원이 앱에서 로그아웃됩니다.</li>
          </ul>
        </div>
        <button type="button" className="adm-btn adm-btn-danger" onClick={show}>
          <AlertTriangle size={14} />
          전체 초기화
        </button>
      </div>

      {result && (
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-success/10 text-[12.5px]" role="status">
          <p className="font-semibold text-success">초기화가 완료되었습니다. 삭제된 건수:</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            {COUNT_LABELS.map((c) => (
              <span key={c.key}>
                {c.label} <b>{fmtNumber(result[c.key])}</b>
              </span>
            ))}
          </p>
        </div>
      )}

      <Modal
        open={open}
        title={<span className="text-error">전체 데이터 초기화</span>}
        onClose={close}
        footer={
          <>
            <button type="button" className="adm-btn" onClick={close} disabled={busy}>
              취소
            </button>
            <button type="button" className="adm-btn adm-btn-danger" onClick={run} disabled={!ready || busy}>
              {busy ? '초기화 중…' : '초기화'}
            </button>
          </>
        }
      >
        <ErrorBox message={error} />
        <p className="mb-3 px-3 py-2 rounded-lg bg-error/10 text-error text-[12.5px] font-medium">
          회원·센서 등록·혈당·이벤트·알람·앱 설정이 모두 삭제되며 되돌릴 수 없습니다.
        </p>
        <form
          className="grid gap-3"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Field label="본인 비밀번호">
            <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" disabled={busy} autoFocus />
          </Field>
          <Field
            label="확인 문구"
            hint={
              <>
                아래 문구를 그대로 입력하세요: <span className="mono font-semibold text-base-content">{CONFIRM_PHRASE}</span>
              </>
            }
          >
            <input className="adm-input mono" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy} placeholder={CONFIRM_PHRASE} />
          </Field>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>
    </Panel>
  );
}
