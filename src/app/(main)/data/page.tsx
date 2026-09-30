'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, RotateCcw, Search, Trash2, UserSearch, X } from 'lucide-react';
import { api, download, errorMessage, type Query } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dialog } from '@/lib/dialog';
import { fmtDateTime, fmtNumber, kstDay } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useList } from '@/lib/useList';
import { Field, PageTitle, Panel, Spinner } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import MemberPicker, { type PickedMember } from '@/components/data/MemberPicker';

type GlucoseRow = {
  id: string;
  eqsn: string;
  value: number;
  time: string;
  trid: number | string | null;
  uploadedAt: string | null;
  userId: string | null;
  userEmail: string;
  userLabel: string;
};

type Filters = {
  /** 회원 검색어(이메일·이름). 회원을 직접 고르면(userId) 쓰지 않는다. */
  user: string;
  userId: string;
  sn: string;
  exactSn: boolean;
  mac: string;
  from: string;
  to: string;
};

type DeleteDryRun = { ok: boolean; dryRun: true; count: number };
type DeleteResult = { ok: boolean; deleted: number };

const todayFilters = (): Filters => ({ user: '', userId: '', sn: '', exactSn: false, mac: '', from: kstDay(0), to: kstDay(0) });

/**
 * 주소의 조건으로 처음 필터를 만든다. 기간의 기본값은 오늘(한국시간)이지만,
 * 회원·SN 을 지정해 들어온 링크에 기간이 없으면 전체 기간으로 둔다(오늘 데이터가 없는 만료 센서도 바로 보이도록).
 */
function filtersFromUrl(p: URLSearchParams): Filters {
  const userId = p.get('userId')?.trim() || '';
  const sn = p.get('sn')?.trim() || '';
  const from = p.get('from');
  const to = p.get('to');
  const narrowed = !!userId || !!sn;
  const fallbackDay = narrowed ? '' : kstDay(0);
  return {
    user: '',
    userId,
    sn,
    exactSn: !!sn && p.get('exactSn') === 'true',
    mac: '',
    from: from ?? fallbackDay,
    to: to ?? fallbackDay,
  };
}

function toQuery(f: Filters): Query {
  return {
    user: f.userId ? '' : f.user.trim(),
    userId: f.userId,
    sn: f.sn.trim(),
    exactSn: f.exactSn && f.sn.trim() ? 'true' : '',
    mac: f.mac.trim(),
    from: f.from,
    to: f.to,
  };
}

const COLUMNS: Column<GlucoseRow>[] = [
  { key: 'time', title: '측정 시각', render: (r) => fmtDateTime(r.time, true) },
  { key: 'value', title: '값 (mg/dL)', num: true, render: (r) => <b>{r.value}</b> },
  {
    key: 'eqsn',
    title: 'S/N',
    render: (r) =>
      r.eqsn && r.eqsn !== '—' ? (
        <Link href={`/devices/${encodeURIComponent(r.eqsn)}`} prefetch={false} className="mono text-primary hover:underline">
          {r.eqsn}
        </Link>
      ) : (
        <span className="text-base-content/50">—</span>
      ),
  },
  {
    key: 'user',
    title: '회원',
    render: (r) =>
      r.userId ? (
        <Link href={`/users/${r.userId}`} prefetch={false} className="text-primary hover:underline" title={r.userLabel}>
          {r.userEmail}
        </Link>
      ) : (
        <span className="text-base-content/50">{r.userEmail}</span>
      ),
  },
  { key: 'trid', title: 'trid', num: true, render: (r) => <span className="mono">{r.trid ?? '—'}</span> },
  { key: 'uploadedAt', title: '업로드 시각', render: (r) => fmtDateTime(r.uploadedAt, true) },
];

function DataScreen() {
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const [initial] = useState(() => filtersFromUrl(searchParams));
  const [draft, setDraft] = useState<Filters>(initial);
  const [applied, setApplied] = useState<Filters>(initial);
  /** 선택한 회원의 표시 정보. 주소로 들어온 경우 조회가 끝날 때까지 null 이다. */
  const [member, setMember] = useState<PickedMember | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useMemo(() => toQuery(applied), [applied]);
  const list = useList<GlucoseRow>('/data', query, { limit: 50 });

  // 주소에 userId 로 들어온 회원의 이메일을 가져와 칩에 보여 준다.
  const urlUserId = initial.userId;
  useEffect(() => {
    if (!urlUserId) return;
    const ctrl = new AbortController();
    api<{ id: string; email: string; name: string; label: string }>(`/users/${encodeURIComponent(urlUserId)}`, { signal: ctrl.signal })
      .then((u) => setMember((cur) => cur ?? { id: u.id, email: u.email, name: u.name || u.label }))
      .catch((e) => {
        if (e?.name !== 'AbortError') toast.error(`회원 정보를 불러오지 못했습니다: ${errorMessage(e)}`);
      });
    return () => ctrl.abort();
  }, [urlUserId]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      toast.error('기간의 시작일이 종료일보다 늦습니다.');
      return;
    }
    setApplied(draft);
    list.reload();
  };

  const reset = () => {
    const f = todayFilters();
    setMember(null);
    setDraft(f);
    setApplied(f);
  };

  // 회원을 고르거나 해제하는 것은 그 자체가 조회 조건의 확정이므로 바로 적용한다.
  const pickMember = (m: PickedMember) => {
    const next = { ...draft, user: '', userId: m.id };
    setMember(m);
    setDraft(next);
    setApplied(next);
    setPickerOpen(false);
  };

  const clearMember = () => {
    const next = { ...draft, userId: '' };
    setMember(null);
    setDraft(next);
    setApplied(next);
  };

  const hasFilter = Object.values(query).some((v) => v !== '');
  const memberText = member?.email || '회원 불러오는 중…';

  const exportCsv = async () => {
    if (!hasFilter) {
      toast.error('내보낼 조건(회원·S/N·MAC·기간 중 하나)을 지정하고 조회한 뒤 내보내 주세요.');
      return;
    }
    setExporting(true);
    try {
      await download('/data/export.csv', query, `cgms-glucose-${kstDay(0)}.csv`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const sn = applied.sn.trim();
  // 삭제 API 의 sn 은 항상 정확히 일치로 동작한다. 부분 일치로 조회한 상태에서 지우면 화면과 범위가 달라진다.
  const deleteBlocked = !applied.userId
    ? '회원 한 명을 선택해야 삭제할 수 있습니다.'
    : sn && !applied.exactSn
      ? "S/N 조건으로 삭제하려면 '정확히 일치'를 켜고 다시 조회해 주세요."
      : '';

  const deleteData = async () => {
    if (deleteBlocked) return;
    const scope = { userId: applied.userId, sn: sn || undefined, from: applied.from || undefined, to: applied.to || undefined };
    setDeleting(true);
    try {
      const dry = await api<DeleteDryRun>('/data/delete', { body: { ...scope, dryRun: true } });
      if (!dry.count) {
        toast.info('삭제할 혈당 데이터가 없습니다.');
        return;
      }
      const lines = [
        `회원 ${member?.email || applied.userId} 의 혈당 ${fmtNumber(dry.count)}건을 삭제합니다. 복구할 수 없습니다.`,
        '',
        `기간: ${applied.from || '처음'} ~ ${applied.to || '끝'}`,
        `S/N: ${sn ? sn.toUpperCase() : '전체'}`,
        '',
        '계속하려면 DELETE 를 입력해 주세요.',
      ];
      const typed = await dialog.prompt(lines.join('\n'), { title: '혈당 데이터 삭제', requireText: 'DELETE', placeholder: 'DELETE', danger: true, okText: '삭제' });
      if (typed == null) return;
      const r = await api<DeleteResult>('/data/delete', { body: { ...scope, confirm: 'DELETE' } });
      toast.success(`혈당 데이터 ${fmtNumber(r.deleted)}건을 삭제했습니다.`);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="데이터 관리"
        desc="앱에서 올라온 혈당 측정값을 조회·내보내기 합니다. 시각은 모두 한국시간입니다."
        right={
          <>
            {can('data.export') && (
              <button type="button" className="adm-btn" onClick={() => void exportCsv()} disabled={exporting} title="조회한 조건 그대로 내보냅니다 (최대 20만 행)">
                {exporting ? <Spinner /> : <Download size={14} />}
                CSV 내보내기
              </button>
            )}
            {can('data.delete') && (
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => void deleteData()} disabled={deleting || !!deleteBlocked} title={deleteBlocked || '조회한 회원·S/N·기간의 혈당 데이터를 삭제합니다'}>
                {deleting ? <Spinner /> : <Trash2 size={14} />}
                데이터 삭제
              </button>
            )}
          </>
        }
      />

      <form onSubmit={search} className="adm-card p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-3 items-end">
        <div className="min-w-0">
          {draft.userId ? (
            <>
              <span className="adm-label">회원</span>
              <div className="flex h-9 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 pl-3 pr-1 text-[13px]">
                <Link href={`/users/${draft.userId}`} prefetch={false} className="min-w-0 flex-1 truncate font-semibold text-primary hover:underline" title={member?.name || undefined}>
                  {memberText}
                </Link>
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm !px-1.5" onClick={clearMember} aria-label="회원 선택 해제">
                  <X size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="adm-label" htmlFor="data-user">
                회원 검색
              </label>
              <div className="flex gap-1.5">
                <input id="data-user" className="adm-input" value={draft.user} onChange={(e) => set('user', e.target.value)} placeholder="이메일 · 이름 일부" />
                {can('users.read') && (
                  <button type="button" className="adm-btn !px-2.5" onClick={() => setPickerOpen(true)} aria-label="회원 한 명 선택" title="회원 한 명 선택">
                    <UserSearch size={15} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="min-w-0">
          <label className="adm-label" htmlFor="data-sn">
            S/N
          </label>
          <div className="flex items-center gap-2">
            <input id="data-sn" className="adm-input mono" value={draft.sn} onChange={(e) => set('sn', e.target.value)} placeholder="예: C21Z00102" />
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-base-content/75">
              <input type="checkbox" className="checkbox checkbox-xs checkbox-primary" checked={draft.exactSn} onChange={(e) => set('exactSn', e.target.checked)} />
              정확히 일치
            </label>
          </div>
        </div>

        <Field label="MAC">
          <input className="adm-input mono" value={draft.mac} onChange={(e) => set('mac', e.target.value)} placeholder="12자리 전체" />
        </Field>

        <div className="min-w-0">
          <span className="adm-label">기간 (한국시간)</span>
          <div className="flex items-center gap-1.5">
            <input type="date" className="adm-input" value={draft.from} max={draft.to || undefined} onChange={(e) => set('from', e.target.value)} aria-label="시작일" />
            <span className="text-base-content/50">~</span>
            <input type="date" className="adm-input" value={draft.to} min={draft.from || undefined} onChange={(e) => set('to', e.target.value)} aria-label="종료일" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="adm-btn adm-btn-primary">
            <Search size={14} />
            조회
          </button>
          <button type="button" className="adm-btn" onClick={reset}>
            <RotateCcw size={14} />
            초기화
          </button>
        </div>
      </form>

      <Panel title="혈당 데이터" right={<span className="text-base-content/60">최근 측정 순</span>}>
        <DataTable
          columns={COLUMNS}
          rows={list.items}
          rowKey={(r) => r.id}
          loading={list.loading}
          error={list.error}
          emptyText="조건에 맞는 혈당 데이터가 없습니다"
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.setPage}
          onLimit={list.setLimit}
        />
      </Panel>

      {pickerOpen && <MemberPicker initialQuery={draft.user} onPick={pickMember} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      }
    >
      <DataScreen />
    </Suspense>
  );
}
