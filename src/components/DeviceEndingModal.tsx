'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { PROVIDER_LABEL, fmtDate, fmtDateTime, fmtMac } from '@/lib/format';
import { countryLabel } from '@/lib/countryMeta';
import { ErrorBox, Spinner } from '@/components/ui/adm';
import Modal from '@/components/ui/Modal';

export type EndingDevice = {
  id: string;
  serial: string;
  bleMac: string;
  startAt: string;
  endAt: string;
  remainingMs: number;
  remainingSec: number;
  userId: string | null;
  userEmail: string;
  userLabel: string;
  userProvider: string;
  userCountryCode: string;
  userUnit: string;
  userCreatedAt: string | null;
};

/** GET /devices/:key 응답 중 이 모달이 쓰는 부분 */
type DeviceDetail = {
  serial: string;
  bleMac: string;
  startAt: string | null;
  endAt: string | null;
  validityDays: number;
  user: {
    id: string;
    email: string;
    name: string;
    provider: string;
    countryCode: string;
    unit: string;
    dateOfBirth: string;
    gender: string;
    createdAt?: string;
  } | null;
};

type Props = {
  device: EndingDevice | null;
  open: boolean;
  onClose: () => void;
  /** 목록 응답의 유효기간(일). 상세가 오기 전까지 표시한다. */
  validityDays: number | null;
  /** 서버 시각 − 브라우저 시각(ms). 카운트다운을 서버 시각에 맞춘다. */
  clockOffsetMs: number;
};

/** 초 단위 남은 시간: "3시간 4분 5초" */
export function fmtCountdown(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec <= 0) return '종료됨';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export function remainingSec(endAt: string | null | undefined, nowMs: number): number | null {
  if (!endAt) return null;
  const end = new Date(endAt).getTime();
  return Number.isNaN(end) ? null : Math.max(0, Math.floor((end - nowMs) / 1000));
}

export default function DeviceEndingModal({ device, open, onClose, validityDays, clockOffsetMs }: Props) {
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const deviceId = device?.id;

  useEffect(() => {
    setDetail(null);
    setError('');
    if (!open || !deviceId) return;
    const ctrl = new AbortController();
    setLoading(true);
    api<DeviceDetail>(`/devices/${encodeURIComponent(deviceId)}`, { signal: ctrl.signal })
      .then(setDetail)
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(errorMessage(e));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [open, deviceId]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!device) return null;

  const user = detail?.user;
  const serial = detail?.serial || device.serial;
  const userId = user?.id || device.userId;
  const endAt = detail?.endAt || device.endAt;
  const days = detail?.validityDays ?? validityDays;
  const country = user?.countryCode || device.userCountryCode;

  return (
    <Modal
      open={open}
      title="종료 예정 기기"
      onClose={onClose}
      width={640}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose}>
            닫기
          </button>
          <Link href={`/devices/${encodeURIComponent(serial)}`} prefetch={false} className="adm-btn">
            기기 상세
          </Link>
          {userId && (
            <Link href={`/users/${userId}`} prefetch={false} className="adm-btn adm-btn-primary">
              회원 상세
            </Link>
          )}
        </>
      }
    >
      <ErrorBox message={error} />

      <h4 className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-base-content/70">
        기기 정보 {loading && <Spinner />}
      </h4>
      <dl className="adm-dl mb-5">
        <dt>S/N</dt>
        <dd className="mono font-semibold">{serial}</dd>
        <dt>MAC</dt>
        <dd className="mono">{fmtMac(detail?.bleMac || device.bleMac)}</dd>
        <dt>시작</dt>
        <dd>{fmtDateTime(detail?.startAt || device.startAt)}</dd>
        <dt>종료 예정</dt>
        <dd>{fmtDateTime(endAt)}</dd>
        <dt>잔여 시간</dt>
        <dd className="text-[16px] font-bold text-error tabular-nums">{fmtCountdown(remainingSec(endAt, now + clockOffsetMs))}</dd>
        <dt>유효 기간</dt>
        <dd>{days != null ? `${days}일` : '—'}</dd>
      </dl>

      <h4 className="mb-2 text-[12.5px] font-bold text-base-content/70">회원 정보</h4>
      <dl className="adm-dl">
        <dt>이름</dt>
        <dd className="font-semibold">{user?.name || device.userLabel || '—'}</dd>
        <dt>이메일</dt>
        <dd>{user?.email || device.userEmail || '—'}</dd>
        <dt>가입 경로</dt>
        <dd>{PROVIDER_LABEL[user?.provider || device.userProvider] || user?.provider || device.userProvider || '—'}</dd>
        <dt>국가</dt>
        <dd>{country ? `${countryLabel(country)} (${country})` : '—'}</dd>
        <dt>단위</dt>
        <dd>{user?.unit || device.userUnit || '—'}</dd>
        {user?.dateOfBirth && (
          <>
            <dt>생년월일</dt>
            <dd>{String(user.dateOfBirth).slice(0, 10)}</dd>
          </>
        )}
        {user?.gender && (
          <>
            <dt>성별</dt>
            <dd>{user.gender}</dd>
          </>
        )}
        <dt>가입일</dt>
        <dd>{fmtDate(user?.createdAt || device.userCreatedAt)}</dd>
      </dl>
    </Modal>
  );
}
