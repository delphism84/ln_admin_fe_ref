'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ErrorBox, Field } from '@/components/ui/adm';
import { api, errorMessage } from '@/lib/api';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { ROLE_LABEL } from '@/lib/format';
import type { Admin } from '@/lib/auth';

/** GET /admins 의 항목 — 로그인 세션의 Admin 에 목록용 필드가 더 붙는다. */
export type AdminAccount = Admin & { lastLoginIp: string | null; createdAt: string; updatedAt: string };

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** 서버와 같은 비밀번호 규칙(10자 이상, 영문+숫자). 문제가 없으면 빈 문자열. */
function passwordProblem(pw: string): string {
  if (pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return '비밀번호에 영문과 숫자를 모두 넣어 주세요.';
  return '';
}

function RoleSelect({ roles, value, onChange }: { roles: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="adm-input" value={value} onChange={(e) => onChange(e.target.value)}>
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r] || r}
        </option>
      ))}
    </select>
  );
}

export function AdminCreateModal({ roles, onClose, onChanged }: { roles: string[]; onClose: () => void; onChanged: () => void }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(roles.includes('viewer') ? 'viewer' : roles[0] || 'viewer');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const id = username.trim().toLowerCase();
    if (!USERNAME_RE.test(id)) return setError('아이디는 영문 소문자·숫자 3~32자로 입력해 주세요.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('비밀번호 확인이 일치하지 않습니다.');
    setBusy(true);
    setError('');
    try {
      await api('/admins', { body: { username: id, name: name.trim(), role, password } });
      toast.success(`관리자 ${id} 계정을 만들었습니다.`);
      onChanged();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="관리자 추가"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>
            {busy ? '추가 중…' : '추가'}
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="아이디" hint="영문 소문자·숫자 3~32자">
            <input className="adm-input mono" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={32} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus />
          </Field>
          <Field label="이름">
            <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
          </Field>
        </div>
        <Field label="역할">
          <RoleSelect roles={roles} value={role} onChange={setRole} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="초기 비밀번호" hint="10자 이상, 영문과 숫자 포함">
            <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="초기 비밀번호 확인">
            <input className="adm-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <p className="px-3 py-2 rounded-lg bg-info/10 text-info text-[12.5px]">
          새 관리자는 처음 로그인할 때 비밀번호를 반드시 변경해야 다른 메뉴를 사용할 수 있습니다. 초기 비밀번호는 안전한 방법으로 전달해 주세요.
        </p>
      </div>
    </Modal>
  );
}

type EditProps = { target: AdminAccount; isSelf: boolean; roles: string[]; onClose: () => void; onChanged: () => void };

export function AdminEditModal({ target, isSelf, roles, onClose, onChanged }: EditProps) {
  const [name, setName] = useState(target.name || '');
  const [role, setRole] = useState(target.role);
  const [status, setStatus] = useState(target.status);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const roleOptions = roles.includes(target.role) ? roles : [...roles, target.role];

  async function save() {
    const patch: { name?: string; role?: string; status?: string; password?: string } = {};
    if (name.trim() !== (target.name || '')) patch.name = name.trim();
    if (role !== target.role) patch.role = role;
    if (status !== target.status) patch.status = status;
    if (password) {
      const problem = passwordProblem(password);
      if (problem) return setError(problem);
      patch.password = password;
    }
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    setError('');
    try {
      await api(`/admins/${target.id}`, { method: 'PATCH', body: patch });
      toast.success(`${target.username} 계정을 수정했습니다.`);
      onChanged();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await dialog.confirm(`관리자 "${target.username}" 계정을 삭제할까요?\n삭제하면 되돌릴 수 없습니다. 잠시 막으려면 상태를 '중지'로 바꾸세요.`, {
      danger: true,
      title: '관리자 삭제',
      okText: '삭제',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/admins/${target.id}`, { method: 'DELETE' });
      toast.success(`${target.username} 계정을 삭제했습니다.`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`관리자 수정 — ${target.username}${isSelf ? ' (나)' : ''}`}
      onClose={onClose}
      footer={
        <>
          {!isSelf && (
            <button type="button" className="adm-btn adm-btn-danger mr-auto" onClick={remove} disabled={busy}>
              <Trash2 size={14} />
              삭제
            </button>
          )}
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid gap-3">
        <Field label="이름">
          <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="역할">
            <RoleSelect roles={roleOptions} value={role} onChange={setRole} />
          </Field>
          <Field label="상태">
            <select className="adm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">사용</option>
              <option value="disabled">중지</option>
            </select>
          </Field>
        </div>
        <Field label="비밀번호 재설정 (선택)" hint="비워 두면 기존 비밀번호를 유지합니다. 입력 시 10자 이상, 영문과 숫자 포함">
          <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <p className="px-3 py-2 rounded-lg bg-warning/15 text-warning text-[12.5px]">
          역할·상태를 바꾸거나 비밀번호를 재설정하면 이 관리자는 즉시 로그아웃됩니다. 비밀번호를 재설정한 경우 다음 로그인 때 새 비밀번호로 변경해야 합니다.
          {isSelf && ' 본인 계정이므로 저장 후 다시 로그인해야 할 수 있습니다.'}
        </p>
      </div>
    </Modal>
  );
}
