'use client';

import { useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { Field, PageTitle, Pill } from '@/components/ui/adm';
import FilterCard from '@/components/system/FilterCard';
import RequirePerm from '@/components/system/RequirePerm';
import { useList } from '@/lib/useList';
import { PROVIDER_LABEL, fmtDateTime, kstDay } from '@/lib/format';

/** GET /login-logs 의 항목 */
type LoginLog = {
  id: string;
  at: string;
  kind: 'admin' | 'user';
  identifier?: string;
  success: boolean;
  reason?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
};

type Filters = { kind: string; success: string; q: string; from: string; to: string };

const initialFilters = (): Filters => ({ kind: '', success: '', q: '', from: kstDay(-7), to: kstDay(0) });

const REASON_LABEL: Record<string, string> = {
  bad_password: '비밀번호 불일치',
  unknown_user: '없는 계정',
  disabled: '중지된 계정',
  rate_limited: '시도 초과',
  ip_not_allowed: '허용되지 않은 IP',
  account_suspended: '정지된 회원',
  account_deleted: '탈퇴한 회원',
  missing: '입력 누락',
};

const METHOD_LABEL: Record<string, string> = { ...PROVIDER_LABEL, password: '비밀번호' };

const columns: Column<LoginLog>[] = [
  { key: 'at', title: '일시', render: (l) => <span className="tabular-nums">{fmtDateTime(l.at, true)}</span> },
  { key: 'kind', title: '구분', render: (l) => (l.kind === 'admin' ? <Pill tone="purple">관리자</Pill> : <Pill tone="blue">회원</Pill>) },
  { key: 'identifier', title: '계정', render: (l) => <span className="font-semibold">{l.identifier || '—'}</span> },
  { key: 'success', title: '결과', render: (l) => (l.success ? <Pill tone="green" dot>성공</Pill> : <Pill tone="red" dot>실패</Pill>) },
  { key: 'reason', title: '사유', render: (l) => (l.reason ? <span title={l.reason}>{REASON_LABEL[l.reason] || l.reason}</span> : '—') },
  { key: 'method', title: '방법', render: (l) => (l.method ? METHOD_LABEL[l.method] || l.method : '—') },
  { key: 'ip', title: 'IP', render: (l) => <span className="mono">{l.ip || '—'}</span> },
  {
    key: 'userAgent',
    title: '브라우저/앱',
    render: (l) =>
      l.userAgent ? (
        <span className="inline-block max-w-[280px] truncate align-bottom text-base-content/70" title={l.userAgent}>
          {l.userAgent}
        </span>
      ) : (
        '—'
      ),
  },
];

function LoginLogs() {
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const list = useList<LoginLog>('/login-logs', applied, { limit: 50 });
  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div>
      <PageTitle title="로그인 이력" desc="관리자 콘솔과 모바일 앱의 로그인 시도(성공·실패) 기록입니다." />

      <FilterCard
        onSearch={() => setApplied({ ...draft, q: draft.q.trim() })}
        onReset={() => {
          const f = initialFilters();
          setDraft(f);
          setApplied(f);
        }}
      >
        <Field label="구분" className="w-[calc(50%-6px)] sm:w-32">
          <select className="adm-input" value={draft.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="">전체</option>
            <option value="admin">관리자</option>
            <option value="user">회원</option>
          </select>
        </Field>
        <Field label="결과" className="w-[calc(50%-6px)] sm:w-32">
          <select className="adm-input" value={draft.success} onChange={(e) => set({ success: e.target.value })}>
            <option value="">전체</option>
            <option value="true">성공</option>
            <option value="false">실패</option>
          </select>
        </Field>
        <Field label="검색" className="w-full sm:w-60">
          <input className="adm-input" value={draft.q} onChange={(e) => set({ q: e.target.value })} placeholder="아이디·이메일·IP" />
        </Field>
        <Field label="시작일" className="w-[calc(50%-6px)] sm:w-40">
          <input className="adm-input" type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        </Field>
        <Field label="종료일" className="w-[calc(50%-6px)] sm:w-40">
          <input className="adm-input" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </Field>
      </FilterCard>

      <div className="adm-card">
        <DataTable<LoginLog>
          columns={columns}
          rows={list.items}
          rowKey={(l) => l.id}
          loading={list.loading}
          error={list.error}
          emptyText="조건에 맞는 로그인 기록이 없습니다"
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

export default function LoginLogsPage() {
  return (
    <RequirePerm perm="audit.read" title="로그인 이력" permLabel="감사·로그인 기록">
      <LoginLogs />
    </RequirePerm>
  );
}
