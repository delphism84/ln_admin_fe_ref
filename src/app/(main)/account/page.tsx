'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { useAuth, type Admin } from '@/lib/auth';
import { ErrorBox, Field, PageTitle, Panel } from '@/components/ui/adm';
import { toast } from '@/lib/toast';
import { ROLE_LABEL, fmtDateTime } from '@/lib/format';

function AccountForm() {
  const router = useRouter();
  const force = useSearchParams().get('force') === '1';
  const { admin, setSession } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) return setError('새 비밀번호가 서로 다릅니다.');
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; admin: Admin }>('/me/password', { body: { currentPassword, newPassword } });
      setSession(r.token, r.admin);
      toast.success('비밀번호를 변경했습니다.');
      setCurrent('');
      setNext('');
      setConfirm('');
      if (force) router.replace('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[560px]">
      <PageTitle title="내 계정" />
      {(force || admin?.mustChangePassword) && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-warning/15 text-warning text-[13px] font-medium">
          처음 로그인했거나 비밀번호가 재설정된 계정입니다. 비밀번호를 변경해야 다른 메뉴를 사용할 수 있습니다.
        </div>
      )}
      <Panel title="계정 정보" className="mb-4" bodyClass="p-4">
        <dl className="adm-dl">
          <dt>아이디</dt>
          <dd>{admin?.username}</dd>
          <dt>이름</dt>
          <dd>{admin?.name || '—'}</dd>
          <dt>역할</dt>
          <dd>{ROLE_LABEL[admin?.role || ''] || admin?.role}</dd>
          <dt>마지막 로그인</dt>
          <dd>{fmtDateTime(admin?.lastLoginAt)}</dd>
        </dl>
      </Panel>
      <Panel title="비밀번호 변경" bodyClass="p-4">
        <form onSubmit={submit} className="grid gap-3">
          <ErrorBox message={error} />
          <Field label="현재 비밀번호">
            <input className="adm-input" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="새 비밀번호" hint="10자 이상, 영문과 숫자를 모두 포함">
            <input className="adm-input" type="password" value={newPassword} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={10} />
          </Field>
          <Field label="새 비밀번호 확인">
            <input className="adm-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </Field>
          <div>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
              {busy ? '변경 중…' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountForm />
    </Suspense>
  );
}
