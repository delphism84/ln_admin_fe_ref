'use client';

import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useList } from '@/lib/useList';
import { PROVIDER_LABEL, USER_STATUS, fmtAgo } from '@/lib/format';
import { StatusPill } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

export type PickedMember = { id: string; email: string; name: string };

/** GET /users 목록 행 중 선택 창이 쓰는 부분 */
type UserRow = {
  id: string;
  email: string;
  name: string;
  provider: string;
  status: string;
  deviceCount: number;
  lastUploadAt: string | null;
};

const COLUMNS: Column<UserRow>[] = [
  { key: 'email', title: '이메일', render: (u) => <span className="font-medium text-primary">{u.email}</span> },
  { key: 'name', title: '이름' },
  { key: 'provider', title: '가입 경로', render: (u) => PROVIDER_LABEL[u.provider] || u.provider },
  { key: 'status', title: '상태', render: (u) => <StatusPill map={USER_STATUS} value={u.status} /> },
  { key: 'deviceCount', title: '기기', num: true },
  { key: 'lastUploadAt', title: '마지막 업로드', render: (u) => fmtAgo(u.lastUploadAt) },
];

/** 회원 한 명을 고르는 창. 열 때마다 새로 만들어(부모가 조건부 렌더) 검색 상태를 초기화한다. */
export default function MemberPicker({ initialQuery, onPick, onClose }: { initialQuery: string; onPick: (m: PickedMember) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initialQuery);
  const [applied, setApplied] = useState(initialQuery);
  const list = useList<UserRow>('/users', { user: applied.trim() }, { limit: 25 });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setApplied(draft);
  };

  return (
    <Modal open title="회원 선택" onClose={onClose} width={760}>
      <form onSubmit={submit} className="mb-3 flex items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="adm-label">이메일 · 이름 · 회원 ID</span>
          <input className="adm-input" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="일부만 입력해도 됩니다" autoFocus />
        </label>
        <button type="submit" className="adm-btn adm-btn-primary">
          <Search size={14} />
          조회
        </button>
      </form>
      <div className="rounded-lg border border-base-300 overflow-hidden">
        <DataTable
          columns={COLUMNS}
          rows={list.items}
          rowKey={(u) => u.id}
          loading={list.loading}
          error={list.error}
          emptyText="조건에 맞는 회원이 없습니다"
          onRowClick={(u) => onPick({ id: u.id, email: u.email, name: u.name })}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.setPage}
          onLimit={list.setLimit}
        />
      </div>
      <p className="mt-2 text-[11.5px] text-base-content/55">행을 누르면 그 회원이 선택됩니다. 탈퇴한 회원은 목록에 나오지 않습니다.</p>
    </Modal>
  );
}
