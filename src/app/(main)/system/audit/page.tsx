'use client';

import { useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { Field, PageTitle } from '@/components/ui/adm';
import FilterCard from '@/components/system/FilterCard';
import RequirePerm from '@/components/system/RequirePerm';
import { AuditDetailModal, AuditTarget, TARGET_TYPES, TARGET_TYPE_LABEL, actionLabel, type AuditLog } from '@/components/system/audit';
import { useList } from '@/lib/useList';
import { ROLE_LABEL, fmtDateTime, kstDay } from '@/lib/format';

type Filters = { from: string; to: string; action: string; actor: string; targetType: string; target: string };

const initialFilters = (): Filters => ({ from: kstDay(-7), to: kstDay(0), action: '', actor: '', targetType: '', target: '' });

const columns: Column<AuditLog>[] = [
  { key: 'at', title: '일시', render: (l) => <span className="tabular-nums">{fmtDateTime(l.at, true)}</span> },
  {
    key: 'actor',
    title: '작업자',
    render: (l) => (
      <span>
        <span className="font-semibold">{l.actorName || '—'}</span>
        {l.actorRole && <span className="ml-1.5 text-[11.5px] text-base-content/55">{ROLE_LABEL[l.actorRole] || l.actorRole}</span>}
      </span>
    ),
  },
  {
    key: 'action',
    title: '작업',
    render: (l) => {
      const label = actionLabel(l.action);
      return (
        <div className="leading-tight">
          {label && <div className="font-semibold">{label}</div>}
          <div className="mono text-[11px] text-base-content/55">{l.action}</div>
        </div>
      );
    },
  },
  { key: 'target', title: '대상', render: (l) => <AuditTarget log={l} /> },
  { key: 'ip', title: 'IP', render: (l) => <span className="mono">{l.ip || '—'}</span> },
];

function AuditLogs() {
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const list = useList<AuditLog>('/audit-logs', applied, { limit: 50 });
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const actions: string[] = Array.isArray(list.extra.actions) ? list.extra.actions : [];
  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div>
      <PageTitle title="감사 로그" desc="관리자가 언제 무엇을 바꿨는지 기록합니다. 행을 누르면 변경 전/후 값을 볼 수 있습니다." />

      <FilterCard
        onSearch={() => setApplied({ ...draft, actor: draft.actor.trim(), target: draft.target.trim() })}
        onReset={() => {
          const f = initialFilters();
          setDraft(f);
          setApplied(f);
        }}
      >
        <Field label="시작일" className="w-[calc(50%-6px)] sm:w-40">
          <input className="adm-input" type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        </Field>
        <Field label="종료일" className="w-[calc(50%-6px)] sm:w-40">
          <input className="adm-input" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </Field>
        <Field label="작업" className="w-full sm:w-56">
          <select className="adm-input" value={draft.action} onChange={(e) => set({ action: e.target.value })}>
            <option value="">전체</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a) ? `${actionLabel(a)} (${a})` : a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="작업자" className="w-full sm:w-36">
          <input className="adm-input" value={draft.actor} onChange={(e) => set({ actor: e.target.value })} placeholder="관리자 아이디" />
        </Field>
        <Field label="대상 종류" className="w-full sm:w-36">
          <select className="adm-input" value={draft.targetType} onChange={(e) => set({ targetType: e.target.value })}>
            <option value="">전체</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TARGET_TYPE_LABEL[t]} ({t})
              </option>
            ))}
          </select>
        </Field>
        <Field label="대상 검색" className="w-full sm:w-52">
          <input className="adm-input" value={draft.target} onChange={(e) => set({ target: e.target.value })} placeholder="이메일·SN·id" />
        </Field>
      </FilterCard>

      <div className="adm-card">
        <DataTable<AuditLog>
          columns={columns}
          rows={list.items}
          rowKey={(l) => l.id}
          loading={list.loading}
          error={list.error}
          emptyText="조건에 맞는 기록이 없습니다"
          onRowClick={setDetail}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.setPage}
          onLimit={list.setLimit}
        />
      </div>

      {detail && <AuditDetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default function AuditPage() {
  return (
    <RequirePerm perm="audit.read" title="감사 로그" permLabel="감사·로그인 기록">
      <AuditLogs />
    </RequirePerm>
  );
}
