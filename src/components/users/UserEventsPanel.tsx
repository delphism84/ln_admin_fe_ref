'use client';

import Link from 'next/link';
import { useList } from '@/lib/useList';
import { EVENT_LABEL, fmtDateTime } from '@/lib/format';
import { Panel } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import type { UserEvent } from './types';

const COLUMNS: Column<UserEvent>[] = [
  { key: 'time', title: '시각', render: (r) => fmtDateTime(r.time) },
  { key: 'type', title: '종류', render: (r) => EVENT_LABEL[r.type] || r.type },
  {
    key: 'memo',
    title: '메모',
    render: (r) =>
      r.memo ? (
        <span className="block max-w-[320px] truncate" title={r.memo}>
          {r.memo}
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'eqsn',
    title: 'S/N',
    render: (r) =>
      r.eqsn ? (
        <Link href={`/devices/${encodeURIComponent(r.eqsn)}`} prefetch={false} className="mono text-primary hover:underline">
          {r.eqsn}
        </Link>
      ) : (
        '—'
      ),
  },
];

/** 회원이 앱에 기록한 이벤트(식사·운동·인슐린 등). 최신순, 서버 페이징. */
export default function UserEventsPanel({ userId }: { userId: string }) {
  const list = useList<UserEvent>(`/users/${userId}/events`, {}, { limit: 25 });
  return (
    <Panel title="이벤트">
      <DataTable<UserEvent>
        columns={COLUMNS}
        rows={list.items}
        rowKey={(r) => r.id}
        loading={list.loading}
        error={list.error}
        emptyText="기록된 이벤트가 없습니다"
        total={list.total}
        page={list.page}
        limit={list.limit}
        onPage={list.setPage}
        onLimit={list.setLimit}
      />
    </Panel>
  );
}
