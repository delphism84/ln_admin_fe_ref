'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage, getToken, setToken } from '@/lib/api';
import { ErrorBox } from '@/components/ui/adm';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; admin: { mustChangePassword: boolean } }>('/login', { body: { username: username.trim(), password } });
      setToken(r.token);
      router.replace(r.admin.mustChangePassword ? '/account?force=1' : '/dashboard');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="adm-card w-full max-w-[380px] p-7">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-9 h-9 rounded-xl bg-primary text-primary-content flex items-center justify-center font-black">CG</span>
          <div>
            <div className="text-[17px] font-extrabold leading-tight">EMPECS CGMS</div>
            <div className="text-[12px] text-base-content/60">관리자 콘솔</div>
          </div>
        </div>
        {params.get('expired') && !error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-warning/15 text-warning text-[13px] font-medium">로그인이 만료되었습니다. 다시 로그인해 주세요.</div>
        )}
        <ErrorBox message={error} />
        <label className="block mb-3">
          <span className="adm-label">아이디</span>
          <input className="adm-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="block mb-5">
          <span className="adm-label">비밀번호</span>
          <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" className="adm-btn adm-btn-primary w-full !h-10" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
