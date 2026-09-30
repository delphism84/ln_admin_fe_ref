'use client';

import { Suspense, useEffect, useMemo, useState, type ElementType, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlarmClock, Ban, Boxes, Download, HelpCircle, Package, Plus, QrCode, Radio, TimerOff, Truck } from 'lucide-react';
import { api, download, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useList } from '@/lib/useList';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { DEVICE_STATUS, SOURCE_LABEL, fmtDate, fmtDateTime, fmtMac, fmtNumber, fmtRemaining } from '@/lib/format';
import { Field, Kpi, PageTitle, Pill, Spinner, StatusPill, type Tone } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { useLots } from '@/components/devices/hooks';
import { devicePath, type BulkAction, type BulkResult, type DeviceSummary, type DeviceUnit } from '@/components/devices/types';

type Filters = { sn: string; mac: string; user: string; status: string; verified: string; lot: string; source: string };

const EMPTY: Filters = { sn: '', mac: '', user: '', status: '', verified: '', lot: '', source: '' };

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'stock', label: '재고' },
  { value: 'shipped', label: '출고' },
  { value: 'active', label: '사용 중' },
  { value: 'ending', label: '종료 임박' },
  { value: 'expired', label: '만료' },
  { value: 'blocked', label: '차단' },
  { value: 'registered', label: '앱 등록됨' },
];

const SN_POLICY_TEXT: Record<DeviceSummary['snPolicy'], string> = {
  flag: '재고에 없는 SN 도 등록 허용(표시만)',
  block: '재고에 없는 SN 은 등록 거절',
};

type KpiDef = { key: keyof DeviceSummary; label: string; icon: ElementType; tone: Tone; filter: Partial<Filters> };

const KPIS: KpiDef[] = [
  { key: 'total', label: '전체', icon: Boxes, tone: 'primary', filter: {} },
  { key: 'stock', label: '재고', icon: Package, tone: 'neutral', filter: { status: 'stock' } },
  { key: 'shipped', label: '출고', icon: Truck, tone: 'info', filter: { status: 'shipped' } },
  { key: 'active', label: '사용 중', icon: Radio, tone: 'success', filter: { status: 'active' } },
  { key: 'ending', label: '종료 임박', icon: AlarmClock, tone: 'warning', filter: { status: 'ending' } },
  { key: 'expired', label: '만료', icon: TimerOff, tone: 'warning', filter: { status: 'expired' } },
  { key: 'blocked', label: '차단', icon: Ban, tone: 'error', filter: { status: 'blocked' } },
  { key: 'unverified', label: '미확인 SN', icon: HelpCircle, tone: 'secondary', filter: { verified: 'false' } },
];

function filtersFromParams(p: URLSearchParams): Filters {
  const verified = p.get('verified');
  return {
    ...EMPTY,
    sn: p.get('sn') || '',
    user: p.get('user') || '',
    status: p.get('status') || '',
    verified: verified === 'true' || verified === 'false' ? verified : '',
    lot: (p.get('lot') || '').toUpperCase(),
  };
}

function DevicesList() {
  const router = useRouter();
  const params = useSearchParams();
  const paramKey = params.toString();
  const { can } = useAuth();
  const canWrite = can('devices.write');

  const [draft, setDraft] = useState<Filters>(() => filtersFromParams(params));
  const [applied, setApplied] = useState<Filters>(draft);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [summaryTick, setSummaryTick] = useState(0);

  const list = useList<DeviceUnit>('/devices', applied, { limit: 50, sort: 'updatedAt:desc' });
  const { lots } = useLots();

  // 같은 화면에서 주소의 쿼리만 바뀌는 경우(메뉴·로트 링크)에도 필터를 맞춘다.
  useEffect(() => {
    const next = filtersFromParams(new URLSearchParams(paramKey));
    setDraft(next);
    setApplied(next);
    setSelected(new Set());
  }, [paramKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    api<DeviceSummary>('/devices/summary', { signal: ctrl.signal })
      .then(setSummary)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        toast.error(errorMessage(e));
      });
    return () => ctrl.abort();
  }, [summaryTick]);

  const apply = (next: Filters) => {
    setDraft(next);
    setApplied(next);
    setSelected(new Set());
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    apply({ ...draft, sn: draft.sn.trim(), mac: draft.mac.trim(), user: draft.user.trim() });
  };
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const lotOptions = useMemo(() => {
    const codes = lots.map((l) => l.code);
    if (draft.lot && draft.lot !== '-' && !codes.includes(draft.lot)) codes.unshift(draft.lot);
    return codes;
  }, [lots, draft.lot]);

  const serials = useMemo(() => [...selected], [selected]);

  const runBulk = async (action: BulkAction, extra: Record<string, string>, done: string) => {
    setBusy(true);
    try {
      const r = await api<BulkResult>('/devices/bulk', { body: { serials, action, ...extra } });
      toast.success(`${done} (${fmtNumber(r.modified)}건 변경 / ${fmtNumber(r.matched)}건 대상)`);
      setSelected(new Set());
      list.reload();
      setSummaryTick((t) => t + 1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const n = serials.length;
  const onShip = async () => {
    const shippedTo = await dialog.prompt(`선택한 ${n}건을 출고 처리합니다. 출고처를 입력해 주세요.`, { title: '출고 처리', placeholder: '출고처(병원·대리점 등)', okText: '출고 처리' });
    if (shippedTo === null) return;
    await runBulk('ship', { shippedTo: shippedTo.trim() }, '출고 처리했습니다');
  };
  const onStock = async () => {
    if (!(await dialog.confirm(`선택한 ${n}건을 재고 단계로 되돌릴까요?`, { title: '재고로' }))) return;
    await runBulk('stock', {}, '재고로 되돌렸습니다');
  };
  const onVerify = async () => {
    if (!(await dialog.confirm(`선택한 ${n}건을 확인된 SN 으로 처리할까요?`, { title: '확인 처리' }))) return;
    await runBulk('verify', {}, '확인 처리했습니다');
  };
  const onSetLot = async () => {
    const code = await dialog.prompt(`선택한 ${n}건의 로트를 지정합니다. 없는 로트 코드는 새로 만들어집니다. 비워 두면 로트 미지정이 됩니다.`, { title: '로트 지정', placeholder: '로트 코드', okText: '지정' });
    if (code === null) return;
    await runBulk('setLot', { lotCode: code.trim().toUpperCase() }, '로트를 지정했습니다');
  };
  const onBlock = async () => {
    const reason = await dialog.prompt(`선택한 ${n}건을 차단합니다. 앱에서 이 센서들을 새로 등록할 수 없게 됩니다. 이미 올라오는 데이터는 막지 않습니다.`, { title: '차단', placeholder: '차단 사유', danger: true, okText: '차단' });
    if (reason === null) return;
    await runBulk('block', { reason: reason.trim() }, '차단했습니다');
  };
  const onUnblock = async () => {
    if (!(await dialog.confirm(`선택한 ${n}건의 차단을 해제할까요?`, { title: '차단 해제' }))) return;
    await runBulk('unblock', {}, '차단을 해제했습니다');
  };
  const onQr = () => router.push(`/devices/qr?serials=${encodeURIComponent(serials.join(','))}`);

  const onExport = async () => {
    setExporting(true);
    try {
      await download('/devices/export.csv', applied, 'cgms-devices.csv');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<DeviceUnit>[] = [
    {
      key: 'serial',
      title: 'S/N',
      sortKey: 'serial',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Link href={devicePath(r.serial)} prefetch={false} className="mono font-semibold text-primary hover:underline">
            {r.serial}
          </Link>
          {!r.formatOk && <Pill tone="amber" title="SN 형식이 규칙과 다릅니다">형식</Pill>}
          {!r.verified && <Pill tone="purple" title="재고에 없던 SN 을 앱이 등록했습니다">미확인</Pill>}
        </span>
      ),
    },
    { key: 'bleMac', title: 'MAC', render: (r) => <span className="mono">{fmtMac(r.bleMac)}</span> },
    { key: 'lotCode', title: '로트', sortKey: 'lotCode', render: (r) => r.lotCode || '—' },
    { key: 'status', title: '상태', render: (r) => <StatusPill map={DEVICE_STATUS} value={r.status} /> },
    {
      key: 'owner',
      title: '회원',
      render: (r) =>
        r.owner ? (
          <Link href={`/users/${r.owner.id}`} prefetch={false} className="text-primary hover:underline" title={r.owner.email}>
            {r.owner.label || r.owner.email}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'startAt', title: '시작', sortKey: 'startAt', render: (r) => fmtDateTime(r.startAt) },
    { key: 'endAt', title: '만료', render: (r) => fmtDateTime(r.endAt) },
    {
      key: 'remainingMs',
      title: '남은 시간',
      render: (r) => <span className={r.remainingMs != null && r.remainingMs < 0 ? 'text-base-content/55' : ''}>{fmtRemaining(r.remainingMs)}</span>,
    },
    { key: 'source', title: '출처', render: (r) => SOURCE_LABEL[r.source] || r.source },
    { key: 'createdAt', title: '등록일', sortKey: 'createdAt', render: (r) => fmtDate(r.createdAt) },
    { key: 'updatedAt', title: '수정일', sortKey: 'updatedAt', render: (r) => fmtDate(r.updatedAt) },
  ];

  const isKpiOn = (k: KpiDef) =>
    k.key === 'total' ? !applied.status && !applied.verified : Object.entries(k.filter).every(([f, v]) => applied[f as keyof Filters] === v);

  return (
    <div>
      <PageTitle
        title="기기 관리 (SN)"
        desc={
          summary ? (
            <>
              센서 유효기간 {summary.validityDays}일 · SN 정책: {SN_POLICY_TEXT[summary.snPolicy] ?? summary.snPolicy}
              {summary.formatBad > 0 && <> · 형식 불일치 {fmtNumber(summary.formatBad)}건</>}
            </>
          ) : (
            'SN 대장(재고)과 앱 등록 현황을 함께 봅니다.'
          )
        }
        right={
          <>
            {can('data.export') && (
              <button type="button" className="adm-btn" onClick={onExport} disabled={exporting}>
                {exporting ? <Spinner /> : <Download size={15} />} CSV 내보내기
              </button>
            )}
            {canWrite && (
              <Link href="/devices/register" prefetch={false} className="adm-btn adm-btn-primary">
                <Plus size={15} /> SN 등록
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-3 mb-4">
        {KPIS.map((k) => (
          <Kpi
            key={k.key}
            icon={k.icon}
            label={k.label}
            tone={k.tone}
            value={summary ? fmtNumber(Number(summary[k.key])) : '—'}
            onClick={() => apply({ ...EMPTY, ...k.filter })}
            active={isKpiOn(k)}
          />
        ))}
      </div>

      <form className="adm-card p-3 mb-4" onSubmit={onSearch}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <Field label="S/N">
            <input className="adm-input mono" value={draft.sn} onChange={set('sn')} placeholder="C21Z00101" />
          </Field>
          <Field label="MAC">
            <input className="adm-input mono" value={draft.mac} onChange={set('mac')} placeholder="앞부분 일치" />
          </Field>
          <Field label="회원">
            <input className="adm-input" value={draft.user} onChange={set('user')} placeholder="이메일·이름·ID" />
          </Field>
          <Field label="상태">
            <select className="adm-input" value={draft.status} onChange={set('status')}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="확인 여부">
            <select className="adm-input" value={draft.verified} onChange={set('verified')}>
              <option value="">전체</option>
              <option value="true">확인됨</option>
              <option value="false">미확인</option>
            </select>
          </Field>
          <Field label="로트">
            <select className="adm-input" value={draft.lot} onChange={set('lot')}>
              <option value="">전체</option>
              <option value="-">미지정</option>
              {lotOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="출처">
            <select className="adm-input" value={draft.source} onChange={set('source')}>
              <option value="">전체</option>
              {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="adm-btn" onClick={() => apply(EMPTY)}>
            초기화
          </button>
          <button type="submit" className="adm-btn adm-btn-primary">
            조회
          </button>
        </div>
      </form>

      {canWrite && n > 0 && (
        <div className="adm-card p-2.5 mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="선택한 기기 일괄 작업">
          <span className="px-1.5 text-[13px] font-bold text-primary">{fmtNumber(n)}건 선택</span>
          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={onShip}>
            출고 처리
          </button>
          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={onStock}>
            재고로
          </button>
          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={onVerify}>
            확인 처리
          </button>
          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={onSetLot}>
            로트 지정
          </button>
          <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" disabled={busy} onClick={onBlock}>
            차단
          </button>
          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={onUnblock}>
            차단 해제
          </button>
          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={onQr}>
            <QrCode size={13} /> QR 라벨
          </button>
          <button type="button" className="adm-btn adm-btn-sm adm-btn-ghost ml-auto" disabled={busy} onClick={() => setSelected(new Set())}>
            선택 해제
          </button>
        </div>
      )}

      <div className="adm-card">
        <DataTable<DeviceUnit>
          columns={columns}
          rows={list.items}
          rowKey={(r) => r.serial}
          loading={list.loading}
          error={list.error}
          emptyText="조건에 맞는 기기가 없습니다"
          sort={list.sort}
          onSort={list.setSort}
          selected={canWrite ? selected : undefined}
          onSelectedChange={canWrite ? setSelected : undefined}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.setPage}
          onLimit={list.setLimit}
        />
      </div>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center"><Spinner /></div>}>
      <DevicesList />
    </Suspense>
  );
}
