'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, KeyRound, LogOut, Pencil, RotateCcw, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { fmtNumber, USER_STATUS } from '@/lib/format';
import { PageTitle, Panel, Spinner, StatusPill } from '@/components/ui/adm';
import UserEditModal from './UserEditModal';
import UserPasswordModal from './UserPasswordModal';
import UserGlucoseChart from './UserGlucoseChart';
import UserEventsPanel from './UserEventsPanel';
import { AlarmsPanel, DataSummaryPanel, DevicesPanel, LoginsPanel, NotePanel, ProfilePanel } from './UserPanels';
import type { PurgeResult, UserOverview } from './types';

type LoadState = { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error'; message: string } | { kind: 'ready' };

function BackLink() {
  return (
    <Link href="/users" prefetch={false} className="no-print inline-flex items-center gap-1 mb-2 text-[12.5px] font-semibold text-base-content/65 hover:text-primary">
      <ArrowLeft size={14} />
      회원 목록
    </Link>
  );
}

export default function UserDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const { can } = useAuth();
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'edit' | 'password' | null>(null);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    api<UserOverview>(`/users/${encodeURIComponent(userId)}/overview`, { signal: ctrl.signal })
      .then((r) => {
        setOverview(r);
        setState({ kind: 'ready' });
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        // 형식이 틀린 id(400 invalid_id)도 없는 회원으로 안내한다.
        if (e instanceof ApiError && (e.code === 'not_found' || e.code === 'invalid_id')) setState({ kind: 'notFound' });
        else setState({ kind: 'error', message: errorMessage(e) });
      });
    return () => ctrl.abort();
  }, [userId, tick]);

  if (state.kind === 'notFound') {
    return (
      <>
        <BackLink />
        <div className="adm-card p-10 text-center">
          <p className="text-[15px] font-bold">회원을 찾을 수 없습니다</p>
          <p className="mt-1 text-[13px] text-base-content/60">삭제되었거나 주소가 잘못되었습니다.</p>
          <Link href="/users" prefetch={false} className="adm-btn adm-btn-primary mt-4">
            회원 목록으로
          </Link>
        </div>
      </>
    );
  }

  if (!overview) {
    return (
      <>
        <BackLink />
        <div className="adm-card p-10 text-center">
          {state.kind === 'error' ? (
            <>
              <p className="text-[13.5px] text-error">{state.message}</p>
              <button type="button" className="adm-btn mt-4" onClick={reload}>
                다시 시도
              </button>
            </>
          ) : (
            <Spinner />
          )}
        </div>
      </>
    );
  }

  const { user } = overview;
  const base = `/users/${user.id}`;
  const canWrite = can('users.write');
  const canSupport = can('users.support');
  const canDelete = can('users.delete');
  const canViewData = can('data.read');
  const isDeleted = user.status === 'deleted';
  const isSuspended = user.status === 'suspended';

  /** 공통 실행: 중복 클릭 방지 → 요청 → 알림 → 상세 다시 불러오기 */
  const run = async (request: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await request();
      toast.success(done);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forceLogout = async () => {
    const ok = await dialog.confirm(`${user.email} 회원을 모든 기기에서 로그아웃시킬까요?\n회원은 앱에서 다시 로그인해야 합니다.`, {
      title: '강제 로그아웃',
      okText: '로그아웃',
      danger: true,
    });
    if (ok) await run(() => api(`${base}/force-logout`, { method: 'POST' }), '강제 로그아웃했습니다');
  };

  const suspend = async () => {
    const reason = await dialog.prompt(
      `${user.email} 회원을 정지할까요?\n정지된 회원은 로그인과 앱의 모든 서버 기능(혈당 업로드 포함)을 쓸 수 없습니다.\n\n정지 사유(선택, 500자까지)`,
      { title: '회원 정지', okText: '정지', danger: true, multiline: true, placeholder: '정지 사유' },
    );
    if (reason === null) return;
    await run(() => api(`${base}/suspend`, { body: { reason: reason.trim() } }), '회원을 정지했습니다');
  };

  const unsuspend = async () => {
    const ok = await dialog.confirm(`${user.email} 회원의 정지를 해제할까요?`, { title: '정지 해제', okText: '해제' });
    if (ok) await run(() => api(`${base}/unsuspend`, { method: 'POST' }), '정지를 해제했습니다');
  };

  const softDelete = async () => {
    const ok = await dialog.confirm(
      `${user.email} 회원을 탈퇴 처리할까요?\n로그인이 차단되고 기존 로그인은 해제됩니다. 혈당·이벤트 등 데이터는 그대로 남으며 나중에 복구할 수 있습니다.`,
      { title: '탈퇴 처리', okText: '탈퇴 처리', danger: true },
    );
    if (ok) await run(() => api(base, { method: 'DELETE', body: { mode: 'soft' } }), '탈퇴 처리했습니다');
  };

  const restore = async () => {
    const ok = await dialog.confirm(`${user.email} 회원의 탈퇴를 취소하고 정상 상태로 복구할까요?`, { title: '회원 복구', okText: '복구' });
    if (ok) await run(() => api(`${base}/restore`, { method: 'POST' }), '회원을 복구했습니다');
  };

  const purge = async () => {
    const typed = await dialog.prompt(
      [
        `${user.email} 회원을 완전히 삭제합니다.`,
        '',
        '삭제되는 것:',
        `· 회원 계정`,
        `· 혈당 데이터 ${fmtNumber(overview.data.totalPoints)}건, 이벤트 ${fmtNumber(overview.data.eventCount)}건`,
        '· 알람 설정, 앱 설정, 앱에 저장한 센서 정보',
        `· 센서 등록 ${fmtNumber(overview.devices.length)}건 해제(S/N 재고와 이력은 남습니다)`,
        '',
        '이 작업은 복구할 수 없습니다. 계속하려면 회원 이메일을 그대로 입력해 주세요.',
      ].join('\n'),
      { title: '회원 완전 삭제', okText: '완전 삭제', danger: true, requireText: user.email, placeholder: user.email },
    );
    if (typed === null) return;
    setBusy(true);
    try {
      const r = await api<PurgeResult>(base, { method: 'DELETE', body: { mode: 'purge', confirm: user.email } });
      toast.success('회원을 완전히 삭제했습니다');
      const d = r.deleted;
      await dialog.alert(
        [
          `혈당 ${fmtNumber(d.glucose)}건`,
          `이벤트 ${fmtNumber(d.events)}건`,
          `알람 ${fmtNumber(d.alarms)}건`,
          `앱 센서 정보 ${fmtNumber(d.sensors)}건`,
          `앱 설정 ${fmtNumber(d.settings)}건`,
          `센서 등록 해제 ${fmtNumber(d.devicesReleased)}건`,
        ].join('\n'),
        { title: `${user.email} 삭제 완료` },
      );
      router.replace('/users');
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  const closeModalAndReload = () => {
    setModal(null);
    reload();
  };

  const actions = (
    <>
      {busy && <Spinner />}
      {canWrite && (
        <button type="button" className="adm-btn" onClick={() => setModal('edit')} disabled={busy}>
          <Pencil size={14} />
          정보 수정
        </button>
      )}
      {canSupport && !isDeleted && (
        <>
          <button type="button" className="adm-btn" onClick={() => setModal('password')} disabled={busy}>
            <KeyRound size={14} />
            비밀번호 재설정
          </button>
          <button type="button" className="adm-btn" onClick={forceLogout} disabled={busy}>
            <LogOut size={14} />
            강제 로그아웃
          </button>
        </>
      )}
      {canWrite && isSuspended && (
        <button type="button" className="adm-btn" onClick={unsuspend} disabled={busy}>
          <ShieldCheck size={14} />
          정지 해제
        </button>
      )}
      {canWrite && user.status === 'active' && (
        <button type="button" className="adm-btn" onClick={suspend} disabled={busy}>
          <Ban size={14} />
          정지
        </button>
      )}
      {canDelete && (
        <>
          {isDeleted ? (
            <button type="button" className="adm-btn" onClick={restore} disabled={busy}>
              <RotateCcw size={14} />
              복구
            </button>
          ) : (
            <button type="button" className="adm-btn" onClick={softDelete} disabled={busy}>
              <UserX size={14} />
              탈퇴 처리
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-danger" onClick={purge} disabled={busy}>
            <Trash2 size={14} />
            완전 삭제
          </button>
        </>
      )}
    </>
  );

  return (
    <>
      <BackLink />
      <PageTitle
        title={user.label || user.email}
        desc={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill map={USER_STATUS} value={user.status} />
            {user.label !== user.email && <span>{user.email}</span>}
            {state.kind === 'error' && <span className="text-error">새로 고침 실패: {state.message}</span>}
          </span>
        }
        right={actions}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfilePanel user={user} />
        <div className="grid gap-4 content-start min-w-0">
          <NotePanel user={user} canWrite={canWrite} onSaved={reload} />
          <DataSummaryPanel userId={user.id} data={overview.data} stats={overview.stats14d} canViewData={canViewData} />
        </div>

        <div className="xl:col-span-2 min-w-0">
          <DevicesPanel devices={overview.devices} />
        </div>

        {canViewData ? (
          <>
            <div className="xl:col-span-2 min-w-0">
              <UserGlucoseChart userId={user.id} devices={overview.devices} thresholds={overview.stats14d.thresholds} />
            </div>
            <UserEventsPanel userId={user.id} />
          </>
        ) : (
          <Panel title="혈당 그래프 · 이벤트" bodyClass="p-4" className="xl:col-span-2">
            <p className="text-[13px] text-base-content/60">혈당 그래프와 이벤트를 보려면 데이터 조회 권한이 필요합니다.</p>
          </Panel>
        )}
        <AlarmsPanel alarms={overview.alarms} appSetting={overview.appSetting} />
        <div className="xl:col-span-2 min-w-0">
          <LoginsPanel logins={overview.logins} />
        </div>
      </div>

      {modal === 'edit' && <UserEditModal user={user} onClose={() => setModal(null)} onSaved={closeModalAndReload} />}
      {modal === 'password' && <UserPasswordModal user={user} onClose={() => setModal(null)} onDone={closeModalAndReload} />}
    </>
  );
}
