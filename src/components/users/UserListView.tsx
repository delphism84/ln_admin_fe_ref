'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, RotateCcw, Search } from 'lucide-react';
import { download, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useList } from '@/lib/useList';
import { toast } from '@/lib/toast';
import { fmtAgo, fmtDate, fmtDateTime, fmtNumber, PROVIDER_LABEL, USER_STATUS } from '@/lib/format';
import { Field, PageTitle, Pill, StatusPill } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import type { UserListItem } from './types';

export type UserFilters = {
  user: string;
  sn: string;
  mac: string;
  status: string;
  provider: string;
  country: string;
  from: string;
  to: string;
};

export const EMPTY_USER_FILTERS: UserFilters = { user: '', sn: '', mac: '', status: '', provider: '', country: '', from: '', to: '' };

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

function trimFilters(f: UserFilters): UserFilters {
  return {
    user: f.user.trim(),
    sn: f.sn.trim(),
    mac: f.mac.trim(),
    status: f.status,
    provider: f.provider,
    country: f.country.trim().toUpperCase(),
    from: f.from,
    to: f.to,
  };
}

/** 센서가 있는데 24시간 넘게(또는 한 번도) 업로드가 없으면 눈에 띄게 표시한다. */
function LastUploadCell({ row }: { row: UserListItem }) {
  const full = row.lastUploadAt ? fmtDateTime(row.lastUploadAt) : '업로드 기록 없음';
  const stale = row.deviceCount > 0 && (!row.lastUploadAt || Date.now() - new Date(row.lastUploadAt).getTime() > STALE_UPLOAD_MS);
  if (stale) {
    return (
      <Pill tone="amber" title={full}>
        {row.lastUploadAt ? fmtAgo(row.lastUploadAt) : '업로드 없음'}
      </Pill>
    );
  }
  return <span title={full}>{fmtAgo(row.lastUploadAt)}</span>;
}

export default function UserListView({ initial }: { initial: UserFilters }) {
  const router = useRouter();
  const { can } = useAuth();
  const [draft, setDraft] = useState<UserFilters>(initial);
  const [applied, setApplied] = useState<UserFilters>(() => trimFilters(initial));
  const [exporting, setExporting] = useState(false);
  const list = useList<UserListItem>('/users', applied, { limit: 50, sort: 'createdAt:desc' });

  const set = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const search = (e: FormEvent) => {
    e.preventDefault();
    const next = trimFilters(draft);
    // 조건이 그대로면 useList 가 다시 조회하지 않으므로 직접 새로 고친다.
    if (JSON.stringify(next) === JSON.stringify(applied)) list.reload();
    else setApplied(next);
  };

  const reset = () => {
    setDraft(EMPTY_USER_FILTERS);
    setApplied(EMPTY_USER_FILTERS);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await download('/users/export.csv', applied, 'cgms-users.csv');
      toast.success('CSV 를 내려받았습니다');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<Column<UserListItem>[]>(
    () => [
      {
        key: 'email',
        title: '이메일',
        sortKey: 'email',
        render: (r) => (
          <Link href={`/users/${r.id}`} prefetch={false} className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {r.email}
          </Link>
        ),
      },
      { key: 'name', title: '이름', render: (r) => (r.name && r.name !== r.email ? r.name : '—') },
      { key: 'provider', title: '가입 경로', render: (r) => PROVIDER_LABEL[r.provider] || r.provider },
      { key: 'countryCode', title: '국가', render: (r) => r.countryCode || '—' },
      { key: 'status', title: '상태', render: (r) => <StatusPill map={USER_STATUS} value={r.status} /> },
      { key: 'deviceCount', title: '센서 수', num: true, render: (r) => fmtNumber(r.deviceCount) },
      {
        key: 'lastLoginAt',
        title: '마지막 로그인',
        sortKey: 'lastLoginAt',
        render: (r) => <span title={r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : undefined}>{fmtAgo(r.lastLoginAt)}</span>,
      },
      { key: 'lastUploadAt', title: '마지막 업로드', sortKey: 'lastUploadAt', render: (r) => <LastUploadCell row={r} /> },
      {
        key: 'createdAt',
        title: '가입일',
        sortKey: 'createdAt',
        render: (r) => <span title={fmtDateTime(r.createdAt)}>{fmtDate(r.createdAt)}</span>,
      },
    ],
    [],
  );

  return (
    <>
      <PageTitle
        title="회원 관리"
        desc="앱 회원을 검색하고 상세 화면에서 계정·센서·혈당 데이터를 확인합니다."
        right={
          can('data.export') && (
            <button type="button" className="adm-btn" onClick={exportCsv} disabled={exporting}>
              <Download size={15} />
              {exporting ? '내보내는 중…' : 'CSV 내보내기'}
            </button>
          )
        }
      />

      <form className="adm-card p-4 mb-4" onSubmit={search}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="검색">
            <input className="adm-input" value={draft.user} onChange={(e) => set('user', e.target.value)} placeholder="이메일 · 이름 · 회원 ID" />
          </Field>
          <Field label="S/N">
            <input className="adm-input mono" value={draft.sn} onChange={(e) => set('sn', e.target.value)} placeholder="예: C21Z00102" />
          </Field>
          <Field label="MAC" hint="12자리 전체 일치">
            <input className="adm-input mono" value={draft.mac} onChange={(e) => set('mac', e.target.value)} placeholder="04:AC:44:11:11:02" />
          </Field>
          <Field label="상태">
            <select className="adm-input" value={draft.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">전체(탈퇴 제외)</option>
              <option value="active">정상</option>
              <option value="suspended">정지</option>
              <option value="deleted">탈퇴</option>
            </select>
          </Field>
          <Field label="가입 경로">
            <select className="adm-input" value={draft.provider} onChange={(e) => set('provider', e.target.value)}>
              <option value="">전체</option>
              <option value="local">이메일</option>
              <option value="google">Google</option>
              <option value="kakao">Kakao</option>
              <option value="apple">Apple</option>
            </select>
          </Field>
          <Field label="국가코드">
            <input className="adm-input" value={draft.country} onChange={(e) => set('country', e.target.value)} placeholder="예: KR" maxLength={3} />
          </Field>
          <Field label="가입일(시작)">
            <input type="date" className="adm-input" value={draft.from} max={draft.to || undefined} onChange={(e) => set('from', e.target.value)} />
          </Field>
          <Field label="가입일(끝)">
            <input type="date" className="adm-input" value={draft.to} min={draft.from || undefined} onChange={(e) => set('to', e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" className="adm-btn" onClick={reset}>
            <RotateCcw size={14} />
            초기화
          </button>
          <button type="submit" className="adm-btn adm-btn-primary">
            <Search size={14} />
            조회
          </button>
        </div>
      </form>

      <div className="adm-card">
        <DataTable<UserListItem>
          columns={columns}
          rows={list.items}
          rowKey={(r) => r.id}
          loading={list.loading}
          error={list.error}
          emptyText="조건에 맞는 회원이 없습니다"
          onRowClick={(r) => router.push(`/users/${r.id}`)}
          sort={list.sort}
          onSort={list.setSort}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPage={list.setPage}
          onLimit={list.setLimit}
        />
      </div>
    </>
  );
}
