'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Ban, CalendarClock, Copy, Pencil, Printer, ShieldCheck, Trash2, UserMinus, UserRoundCog } from 'lucide-react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { DEVICE_STATUS, HISTORY_LABEL, SOURCE_LABEL, fmtDate, fmtDateTime, fmtMac, fmtNumber, fmtRemaining } from '@/lib/format';
import { EmptyRow, Panel, Pill, Spinner, StatusPill } from '@/components/ui/adm';
import DeviceEditModal from '@/components/devices/DeviceEditModal';
import StartFixModal from '@/components/devices/StartFixModal';
import { useQrImages } from '@/components/devices/hooks';
import { devicePath, type DeviceDetail, type DeviceHistoryItem } from '@/components/devices/types';

const BY_KIND: Record<string, string> = { admin: '관리자', user: '회원', app: '앱', system: '시스템' };

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function HistoryChange({ from, to }: { from: string; to: string }) {
  if (!from && !to) return <>—</>;
  if (!from || from === to) return <>{to}</>;
  return (
    <>
      {to || '—'} <span className="text-base-content/50">← {from}</span>
    </>
  );
}

function HistoryTable({ rows }: { rows: DeviceHistoryItem[] }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>일시</th>
            <th>동작</th>
            <th>회원 ← 이전 회원</th>
            <th>시작시각 ← 이전 시작시각</th>
            <th>처리자</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} text="이력이 없습니다" />
          ) : (
            rows.map((h, i) => (
              <tr key={`${h.at}-${h.action}-${i}`}>
                <td>{fmtDateTime(h.at, true)}</td>
                <td>
                  <Pill tone={h.action === 'block' || h.action === 'rejected' ? 'red' : h.action === 'register' || h.action === 'reregister' ? 'green' : 'gray'}>
                    {HISTORY_LABEL[h.action] || h.action}
                  </Pill>
                </td>
                <td>
                  <HistoryChange from={h.prevUserEmail} to={h.userEmail} />
                </td>
                <td>
                  <HistoryChange from={h.prevStartAt ? fmtDateTime(h.prevStartAt) : ''} to={h.startAt ? fmtDateTime(h.startAt) : ''} />
                </td>
                <td>
                  {BY_KIND[h.byKind] || h.byKind || '—'}
                  {h.byName && <span className="text-base-content/60"> · {h.byName}</span>}
                </td>
                <td className="!whitespace-normal min-w-[160px]">{h.note || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DeviceDetailPage() {
  const router = useRouter();
  const { serial: rawSerial } = useParams<{ serial: string }>();
  const serial = safeDecode(rawSerial);
  const { can } = useAuth();
  const canWrite = can('devices.write');

  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    setNotFound(false);
    api<DeviceDetail>(devicePath(serial), { signal: ctrl.signal })
      .then(setDetail)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(errorMessage(e));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [serial, tick]);

  const qrPayload = detail?.qrPayload || '';
  const qrImage = useQrImages(qrPayload ? [qrPayload] : [])[qrPayload];

  if (notFound) {
    return (
      <div className="adm-card p-10 text-center">
        <p className="text-[15px] font-bold">SN 을 찾을 수 없습니다</p>
        <p className="mt-1 text-base-content/65">
          <span className="mono">{serial}</span> 은(는) 재고에 없고 앱에서 등록된 적도 없습니다.
        </p>
        <Link href="/devices" prefetch={false} className="adm-btn mt-4">
          <ArrowLeft size={15} /> 기기 목록으로
        </Link>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="adm-card p-10 text-center">
        {loading ? <Spinner /> : <p className="text-error font-medium">{error || '불러오지 못했습니다'}</p>}
        {!loading && (
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/devices" prefetch={false} className="adm-btn">
              <ArrowLeft size={15} /> 기기 목록으로
            </Link>
            <button type="button" className="adm-btn adm-btn-primary" onClick={reload}>
              다시 시도
            </button>
          </div>
        )}
      </div>
    );
  }

  const d = detail;
  const registered = !!d.startAt;
  const hasMac = d.bleMac.length === 12;

  const act = async (run: () => Promise<unknown>, done: string, after: () => void = reload) => {
    setBusy(true);
    try {
      await run();
      toast.success(done);
      after();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onBlock = async () => {
    const reason = await dialog.prompt('앱에서 이 센서를 새로 등록할 수 없게 됩니다. 이미 올라오는 데이터는 막지 않습니다.', {
      title: `${d.serial} 차단`, placeholder: '차단 사유', danger: true, okText: '차단',
    });
    if (reason === null) return;
    await act(() => api(`${devicePath(d.serial)}/block`, { body: { reason: reason.trim() } }), '차단했습니다');
  };
  const onUnblock = async () => {
    if (!(await dialog.confirm('차단을 해제하면 앱에서 다시 등록할 수 있습니다.', { title: `${d.serial} 차단 해제`, okText: '차단 해제' }))) return;
    await act(() => api(`${devicePath(d.serial)}/unblock`, { method: 'POST' }), '차단을 해제했습니다');
  };
  const onRelease = async () => {
    const ok = await dialog.confirm('앱 등록 기록을 지웁니다. 재고·이력·혈당 데이터는 남고, 다른 계정이 다시 등록할 수 있게 됩니다.', {
      title: `${d.serial} 소유권 해제`, danger: true, okText: '소유권 해제',
    });
    if (!ok) return;
    await act(() => api(`${devicePath(d.serial)}/release`, { method: 'POST' }), '소유권을 해제했습니다');
  };
  const onTransfer = async () => {
    const target = await dialog.prompt(`이 센서를 다른 회원에게 넘깁니다. 현재 회원(${d.owner?.email || '알 수 없음'})은 더 이상 소유자가 아니게 됩니다.`, {
      title: `${d.serial} 소유권 이전`, placeholder: '받을 회원의 이메일 또는 ID', okText: '이전',
    });
    if (target === null) return;
    if (!target.trim()) {
      toast.error('받을 회원의 이메일 또는 ID 를 입력해 주세요.');
      return;
    }
    await act(() => api(`${devicePath(d.serial)}/transfer`, { body: { userId: target.trim() } }), '소유권을 이전했습니다');
  };
  const onDelete = async () => {
    const ok = await dialog.confirm('재고에서 이 SN 을 삭제합니다. 혈당 데이터는 지워지지 않습니다.', {
      title: `${d.serial} 삭제`, danger: true, okText: '삭제',
    });
    if (!ok) return;
    await act(() => api(devicePath(d.serial), { method: 'DELETE' }), '삭제했습니다', () => router.push('/devices'));
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrPayload);
      toast.success('QR 문자열을 복사했습니다');
    } catch {
      toast.error('복사하지 못했습니다. 문자열을 직접 선택해 복사해 주세요.');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/devices" prefetch={false} className="inline-flex items-center gap-1 text-[12.5px] text-base-content/65 hover:text-primary">
            <ArrowLeft size={14} /> 기기 목록
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="mono !text-[22px] font-extrabold tracking-tight break-all">{d.serial}</h1>
            <StatusPill map={DEVICE_STATUS} value={d.status} />
            {!d.verified && <Pill tone="purple" title="재고에 없던 SN 을 앱이 등록했습니다">미확인</Pill>}
            {!d.formatOk && <Pill tone="amber" title="SN 형식이 규칙과 다릅니다">형식 불일치</Pill>}
            {loading && <Spinner />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <button type="button" className="adm-btn" disabled={busy} onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> 정보 수정
            </button>
          )}
          {canWrite && registered && (
            <>
              <button type="button" className="adm-btn" disabled={busy} onClick={() => setStartOpen(true)}>
                <CalendarClock size={14} /> 시작시각 정정
              </button>
              <button type="button" className="adm-btn" disabled={busy} onClick={onTransfer}>
                <UserRoundCog size={14} /> 소유권 이전
              </button>
              <button type="button" className="adm-btn" disabled={busy} onClick={onRelease}>
                <UserMinus size={14} /> 소유권 해제
              </button>
            </>
          )}
          {canWrite &&
            (d.blocked ? (
              <button type="button" className="adm-btn" disabled={busy} onClick={onUnblock}>
                <ShieldCheck size={14} /> 차단 해제
              </button>
            ) : (
              <button type="button" className="adm-btn adm-btn-danger" disabled={busy} onClick={onBlock}>
                <Ban size={14} /> 차단
              </button>
            ))}
          {can('devices.delete') && (
            <button type="button" className="adm-btn adm-btn-danger" disabled={busy} onClick={onDelete}>
              <Trash2 size={14} /> 삭제
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="기본 정보" bodyClass="p-4" className="xl:col-span-2">
          <dl className="adm-dl">
            <dt>SN 구조</dt>
            <dd>
              {d.formatOk ? (
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>모델 <b className="mono">{d.model || '—'}</b></span>
                  <span>
                    연도 <b className="mono">{d.yearCode || '—'}</b>
                    {d.year != null && <span className="text-base-content/60"> ({d.year}년)</span>}
                  </span>
                  <span>샘플 <b>{d.sample ? '예 (S)' : '아니오'}</b></span>
                  <span>일련번호 <b className="mono">{d.seq != null ? String(d.seq).padStart(5, '0') : '—'}</b></span>
                </span>
              ) : (
                <span className="text-warning">SN 규칙(모델 + 연도 코드 + [S] + 5자리)과 맞지 않아 분해할 수 없습니다.</span>
              )}
            </dd>
            <dt>MAC</dt>
            <dd className="mono">{fmtMac(d.bleMac)}</dd>
            <dt>로트</dt>
            <dd>
              {d.lotCode ? (
                <Link href={`/devices?lot=${encodeURIComponent(d.lotCode)}`} prefetch={false} className="text-primary hover:underline">
                  {d.lotCode}
                </Link>
              ) : (
                <span className="text-base-content/55">미지정</span>
              )}
            </dd>
            <dt>제조일</dt>
            <dd>{fmtDate(d.manufacturedAt)}</dd>
            <dt>단계</dt>
            <dd>{d.stage === 'shipped' ? '출고' : '재고'}</dd>
            <dt>출고처 / 출고일</dt>
            <dd>
              {d.shippedTo || '—'} / {fmtDateTime(d.shippedAt)}
            </dd>
            <dt>출처</dt>
            <dd>{SOURCE_LABEL[d.source] || d.source}</dd>
            <dt>확인 여부</dt>
            <dd>{d.verified ? '확인됨' : '미확인 — 재고에 없던 SN 을 앱이 등록했습니다'}</dd>
            <dt>메모</dt>
            <dd className="whitespace-pre-line">{d.note || '—'}</dd>
            {d.blocked && (
              <>
                <dt>차단 사유</dt>
                <dd className="text-error">
                  {d.blockedReason || '사유 없음'}
                  <span className="text-base-content/60"> ({fmtDateTime(d.blockedAt)})</span>
                </dd>
              </>
            )}
            <dt>등록 / 수정</dt>
            <dd>
              {fmtDateTime(d.createdAt)} / {fmtDateTime(d.updatedAt)}
            </dd>
          </dl>
        </Panel>

        <Panel title="QR" bodyClass="p-4">
          {qrPayload ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border border-base-300 bg-white p-2">
                {qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrImage} alt={`${d.serial} QR 코드`} width={180} height={180} />
                ) : (
                  <div className="w-[180px] h-[180px] flex items-center justify-center">
                    <Spinner />
                  </div>
                )}
              </div>
              <div className="w-full flex items-start gap-2">
                <code className="mono flex-1 min-w-0 break-all rounded-md bg-base-200 px-2 py-1.5">{qrPayload}</code>
                <button type="button" className="adm-btn adm-btn-sm shrink-0" onClick={onCopy}>
                  <Copy size={13} /> 복사
                </button>
              </div>
              {!hasMac && (
                <p className="w-full flex items-start gap-1.5 rounded-lg bg-warning/15 px-3 py-2 text-[12.5px] text-warning">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  MAC 이 없어 SN 만 담긴 QR 입니다. 앱에서 BLE 자동 연결이 되지 않습니다. 정보 수정에서 MAC 을 넣어 주세요.
                </p>
              )}
              <Link href={`/devices/qr?serials=${encodeURIComponent(d.serial)}`} prefetch={false} className="adm-btn adm-btn-sm">
                <Printer size={13} /> 라벨 인쇄
              </Link>
            </div>
          ) : (
            <p className="text-base-content/55">QR 문자열을 만들 수 없습니다.</p>
          )}
        </Panel>

        <Panel title="등록 상태" bodyClass="p-4">
          {registered ? (
            <dl className="adm-dl">
              <dt>회원</dt>
              <dd>
                {d.owner ? (
                  <Link href={`/users/${d.owner.id}`} prefetch={false} className="text-primary hover:underline">
                    {d.owner.label || d.owner.email}
                    {d.owner.label && d.owner.label !== d.owner.email && <span className="text-base-content/60"> · {d.owner.email}</span>}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              <dt>시작</dt>
              <dd>{fmtDateTime(d.startAt)}</dd>
              <dt>만료</dt>
              <dd>{fmtDateTime(d.endAt)}</dd>
              <dt>남은 시간</dt>
              <dd className={d.remainingMs != null && d.remainingMs < 0 ? 'text-warning' : 'font-semibold'}>{fmtRemaining(d.remainingMs)}</dd>
              <dt>유효기간</dt>
              <dd>{d.validityDays}일</dd>
            </dl>
          ) : (
            <p className="text-base-content/55">앱에 등록되지 않은 센서입니다. (유효기간 {d.validityDays}일)</p>
          )}
        </Panel>

        <Panel title="데이터" bodyClass="p-4" className="xl:col-span-2">
          <dl className="adm-dl">
            <dt>혈당 건수</dt>
            <dd className="tabular-nums">{fmtNumber(d.data.points)}</dd>
            <dt>첫 데이터</dt>
            <dd>{fmtDateTime(d.data.firstAt)}</dd>
            <dt>마지막 데이터</dt>
            <dd>{fmtDateTime(d.data.lastAt)}</dd>
            <dt>마지막 값</dt>
            <dd className="tabular-nums">{d.data.lastValue ?? '—'}</dd>
          </dl>
          {can('data.read') && (
            <Link href={`/data?sn=${encodeURIComponent(d.serial)}&exactSn=true`} prefetch={false} className="adm-btn adm-btn-sm mt-3">
              혈당 데이터 보기
            </Link>
          )}
        </Panel>

        <Panel title="이력" right={<span className="text-base-content/60">최근 {d.history.length}건</span>} className="xl:col-span-3">
          <HistoryTable rows={d.history} />
        </Panel>
      </div>

      {canWrite && <DeviceEditModal unit={d} open={editOpen} onClose={() => setEditOpen(false)} onSaved={reload} />}
      {canWrite && registered && (
        <StartFixModal serial={d.serial} startAt={d.startAt} validityDays={d.validityDays} open={startOpen} onClose={() => setStartOpen(false)} onSaved={reload} />
      )}
    </div>
  );
}
