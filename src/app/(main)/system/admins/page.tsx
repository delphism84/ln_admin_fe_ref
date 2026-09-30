'use client';

import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { PageTitle, Pill } from '@/components/ui/adm';
import { AdminCreateModal, AdminEditModal, type AdminAccount } from '@/components/system/AdminModals';
import RequirePerm from '@/components/system/RequirePerm';
import RoleMatrix, { type RolesResponse } from '@/components/system/RoleMatrix';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useList } from '@/lib/useList';
import { ROLE_LABEL, fmtDateTime } from '@/lib/format';

const FALLBACK_ROLES = Object.keys(ROLE_LABEL);

function AdminsManager() {
  const { admin: me } = useAuth();
  // 관리자 수는 적어 서버가 한 번에 모두 준다(페이징 없음).
  const list = useList<AdminAccount>('/admins');
  const [roles, setRoles] = useState<RolesResponse | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminAccount | null>(null);

  useEffect(() => {
    let alive = true;
    api<RolesResponse>('/roles')
      .then((r) => alive && setRoles(r))
      .catch((e) => alive && setRolesError(errorMessage(e)))
      .finally(() => alive && setRolesLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const roleNames = roles?.roles ?? FALLBACK_ROLES;

  const columns: Column<AdminAccount>[] = [
    {
      key: 'username',
      title: '아이디',
      render: (a) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="mono font-semibold">{a.username}</span>
          {a.id === me?.id && <Pill tone="blue">나</Pill>}
        </span>
      ),
    },
    { key: 'name', title: '이름', render: (a) => a.name || '—' },
    { key: 'role', title: '역할', render: (a) => ROLE_LABEL[a.role] || a.role },
    { key: 'status', title: '상태', render: (a) => (a.status === 'active' ? <Pill tone="green" dot>사용</Pill> : <Pill tone="gray" dot>중지</Pill>) },
    { key: 'mustChangePassword', title: '비밀번호 변경 필요', render: (a) => (a.mustChangePassword ? <Pill tone="amber">변경 필요</Pill> : '—') },
    {
      key: 'lastLoginAt',
      title: '마지막 로그인',
      render: (a) => (
        <span>
          {fmtDateTime(a.lastLoginAt)}
          {a.lastLoginIp && <span className="ml-2 mono text-[11.5px] text-base-content/55">{a.lastLoginIp}</span>}
        </span>
      ),
    },
    { key: 'createdAt', title: '생성일', render: (a) => fmtDateTime(a.createdAt) },
  ];

  return (
    <>
      <PageTitle
        title="관리자 계정"
        desc="콘솔에 로그인하는 직원 계정과 역할을 관리합니다."
        right={
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setCreating(true)}>
            <UserPlus size={14} />
            관리자 추가
          </button>
        }
      />

      <div className="adm-card mb-4">
        <DataTable<AdminAccount>
          columns={columns}
          rows={list.items}
          rowKey={(a) => a.id}
          loading={list.loading}
          error={list.error}
          emptyText="관리자 계정이 없습니다"
          onRowClick={setEditing}
          selectedKey={me?.id}
        />
      </div>

      <RoleMatrix data={roles} loading={rolesLoading} error={rolesError} />

      {creating && <AdminCreateModal roles={roleNames} onClose={() => setCreating(false)} onChanged={list.reload} />}
      {editing && (
        <AdminEditModal key={editing.id} target={editing} isSelf={editing.id === me?.id} roles={roleNames} onClose={() => setEditing(null)} onChanged={list.reload} />
      )}
    </>
  );
}

export default function AdminsPage() {
  return (
    <RequirePerm perm="admins.manage" title="관리자 계정" permLabel="관리자 계정">
      <AdminsManager />
    </RequirePerm>
  );
}
