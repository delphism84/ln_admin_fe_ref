'use client';

import { useState } from 'react';
import { Pin, Plus } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { Field, PageTitle, Pill, type PillTone } from '@/components/ui/adm';
import FilterCard from '@/components/system/FilterCard';
import NoticeEditor, { type Notice } from '@/components/system/NoticeEditor';
import { useAuth } from '@/lib/auth';
import { useList } from '@/lib/useList';
import { fmtDateTime } from '@/lib/format';

type Filters = { q: string; active: string };
const EMPTY: Filters = { q: '', active: '' };

/** 앱에 실제로 보이는지까지 반영한 상태(게시 여부 + 게시 기간). */
function noticeState(n: Notice, now: number): { text: string; tone: PillTone } {
  if (!n.active) return { text: '중지', tone: 'gray' };
  if (n.expireAt && new Date(n.expireAt).getTime() < now) return { text: '종료', tone: 'amber' };
  if (n.publishAt && new Date(n.publishAt).getTime() > now) return { text: '예약', tone: 'blue' };
  return { text: '게시 중', tone: 'green' };
}

export default function NoticesPage() {
  const { can } = useAuth();
  const canWrite = can('notices.write');
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const list = useList<Notice>('/notices', applied);
  // undefined = 닫힘, null = 새 공지
  const [editing, setEditing] = useState<Notice | null | undefined>(undefined);

  const now = Date.now();
  const columns: Column<Notice>[] = [
      {
        key: 'pinned',
        title: '고정',
        width: '48px',
        render: (n) => (n.pinned ? <Pin size={14} className="text-primary" aria-label="상단 고정" /> : <span className="text-base-content/30">—</span>),
      },
      { key: 'title', title: '제목', render: (n) => <span className="font-semibold inline-block max-w-[360px] truncate align-bottom" title={n.title}>{n.title}</span> },
      { key: 'language', title: '언어', render: (n) => n.language || '전체' },
      {
        key: 'state',
        title: '상태',
        render: (n) => {
          const s = noticeState(n, now);
          return <Pill tone={s.tone} dot>{s.text}</Pill>;
        },
      },
      { key: 'publishAt', title: '게시 시작', render: (n) => fmtDateTime(n.publishAt) },
      { key: 'expireAt', title: '게시 종료', render: (n) => (n.expireAt ? fmtDateTime(n.expireAt) : '무기한') },
      { key: 'createdBy', title: '작성자', render: (n) => n.createdBy || '—' },
      { key: 'updatedAt', title: '수정일', render: (n) => fmtDateTime(n.updatedAt) },
  ];

  return (
    <div>
      <PageTitle
        title="공지사항"
        desc="게시 중인 공지는 모바일 앱 회원에게 그대로 표시됩니다."
        right={
          canWrite && (
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => setEditing(null)}>
              <Plus size={14} />
              공지 작성
            </button>
          )
        }
      />

      <FilterCard
        onSearch={() => setApplied({ ...draft, q: draft.q.trim() })}
        onReset={() => {
          setDraft(EMPTY);
          setApplied(EMPTY);
        }}
      >
        <Field label="제목 검색" className="w-full sm:w-64">
          <input className="adm-input" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="제목 일부" />
        </Field>
        <Field label="게시 상태" className="w-full sm:w-40">
          <select className="adm-input" value={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.value })}>
            <option value="">전체</option>
            <option value="true">게시 중</option>
            <option value="false">중지</option>
          </select>
        </Field>
      </FilterCard>

      <div className="adm-card">
        <DataTable<Notice>
          columns={columns}
          rows={list.items}
          rowKey={(n) => n.id}
          loading={list.loading}
          error={list.error}
          emptyText="공지사항이 없습니다"
          onRowClick={(n) => setEditing(n)}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.setPage}
          onLimit={list.setLimit}
        />
      </div>

      {editing !== undefined && (
        <NoticeEditor key={editing?.id ?? 'new'} notice={editing} canWrite={canWrite} onClose={() => setEditing(undefined)} onChanged={list.reload} />
      )}
    </div>
  );
}
