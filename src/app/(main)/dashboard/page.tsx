'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, CalendarX, Database, Package, RefreshCw, ShieldAlert, Timer, UserX, Users, WifiOff } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { ALARM_LABEL, fmtAgo, fmtDateTime, fmtNumber } from '@/lib/format';
import { ErrorBox, Kpi, PageTitle, Panel, Pill, Spinner, type PillTone } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatsCharts, { type DayCount, type NameValue } from '@/components/dashboard/StatsCharts';
import { useAutoRefresh } from '@/components/dashboard/useAutoRefresh';

type DeviceLive = {
  eqsn: string;
  userEmail: string;
  userLabel: string;
  activityPct: number;
  avgIntervalSec: number | null;
  points24h: number;
  lastAt: string | null;
};

type RecentAlarm = {
  time: string;
  eqsn: string;
  userEmail: string;
  userLabel: string;
  type: string;
  threshold: number;
  value: number;
  unit: string;
};

type Stats = {
  sensors: { active: number; endingSoon: number; expired: number; blocked: number; inStock: number; unverified: number; validityDays: number };
  users: { suspended: number; new24h: number };
  /** 집계에 실패하면 서버가 null 을 준다 */
  syncGaps: number | null;
  totals: { users: number; devices: number; dataPoints: number };
  lineUsers: DayCount[];
  barGlucose: DayCount[];
  pieDevices: NameValue[];
  devicesLive: DeviceLive[];
  devicesLiveSummary: { count: number; avgActivityPct: number; avgIntervalSec: number | null };
  recentAlarms: RecentAlarm[];
};

const REFRESH_MS = 60 * 1000;

const ALARM_TONE: Record<string, PillTone> = { very_low: 'red', low: 'amber', high: 'amber' };

function fmtInterval(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/** 서버는 SN 을 모르는 데이터에 '—' 를 넣어 준다. 그때는 링크를 걸지 않는다. */
function SerialLink({ sn }: { sn: string }) {
  if (!sn || sn === '—') return <span className="text-base-content/50">—</span>;
  return (
    <Link href={`/devices/${encodeURIComponent(sn)}`} prefetch={false} className="mono text-primary hover:underline">
      {sn}
    </Link>
  );
}

function MemberCell({ label, email }: { label: string; email: string }) {
  return (
    <div className="leading-tight">
      <div className="font-medium">{label}</div>
      {email !== label && <div className="text-[11.5px] text-base-content/55">{email}</div>}
    </div>
  );
}

const LIVE_COLUMNS: Column<DeviceLive>[] = [
  { key: 'eqsn', title: 'S/N', render: (d) => <SerialLink sn={d.eqsn} /> },
  { key: 'user', title: '회원', render: (d) => <MemberCell label={d.userLabel} email={d.userEmail} /> },
  {
    key: 'activityPct',
    title: '24시간 활성률',
    width: '170px',
    render: (d) => (
      <div className="flex items-center gap-2">
        <progress
          className={`progress w-24 h-1.5 ${d.activityPct >= 80 ? 'progress-success' : d.activityPct >= 40 ? 'progress-warning' : 'progress-error'}`}
          value={Math.min(100, d.activityPct)}
          max={100}
          aria-label={`24시간 활성률 ${d.activityPct}%`}
        />
        <span className="tabular-nums font-semibold">{d.activityPct}%</span>
      </div>
    ),
  },
  { key: 'avgIntervalSec', title: '평균 수집 간격', num: true, render: (d) => fmtInterval(d.avgIntervalSec) },
  { key: 'points24h', title: '24시간 건수', num: true, render: (d) => fmtNumber(d.points24h) },
  { key: 'lastAt', title: '마지막 수신', render: (d) => <span title={fmtDateTime(d.lastAt, true)}>{fmtAgo(d.lastAt)}</span> },
];

const ALARM_COLUMNS: Column<RecentAlarm>[] = [
  { key: 'time', title: '시각', render: (a) => fmtDateTime(a.time, true) },
  { key: 'eqsn', title: 'S/N', render: (a) => <SerialLink sn={a.eqsn} /> },
  { key: 'user', title: '회원', render: (a) => <MemberCell label={a.userLabel} email={a.userEmail} /> },
  { key: 'type', title: '종류', render: (a) => <Pill tone={ALARM_TONE[a.type] || 'gray'}>{ALARM_LABEL[a.type] || a.type}</Pill> },
  { key: 'value', title: '값', num: true, render: (a) => <b>{a.value}</b> },
  {
    key: 'threshold',
    title: '기준',
    num: true,
    render: (a) => (
      <span className="text-base-content/70">
        {a.type === 'high' ? '≥' : '≤'} {a.threshold} {a.unit}
      </span>
    ),
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await api<Stats>('/stats');
      if (!alive.current) return;
      setStats(r);
      setError('');
      setLoadedAt(Date.now());
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  useAutoRefresh(load, REFRESH_MS);

  const s = stats;
  const summary = s?.devicesLiveSummary;

  return (
    <div>
      <PageTitle
        title="전체 현황"
        desc={loadedAt ? `${fmtDateTime(loadedAt, true)} 기준 · 1분마다 자동 새로고침` : '회원·센서·데이터 수집 상태를 한눈에 봅니다.'}
        right={
          <button type="button" className="adm-btn" onClick={() => void load()} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw size={14} />}
            새로고침
          </button>
        }
      />
      <ErrorBox message={error} />

      {!s ? (
        !error && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Kpi icon={Users} label="전체 회원" value={fmtNumber(s.totals.users)} sub={`최근 24시간 신규 ${fmtNumber(s.users.new24h)}명`} href="/users" />
            <Kpi icon={Activity} label="사용 중 센서" value={fmtNumber(s.sensors.active)} sub={`유효기간 ${s.sensors.validityDays}일 기준`} tone="success" href="/devices?status=active" />
            <Kpi icon={Timer} label="종료 임박" value={fmtNumber(s.sensors.endingSoon)} sub="곧 유효기간이 끝나는 센서" tone={s.sensors.endingSoon > 0 ? 'warning' : 'neutral'} href="/devices/ending" />
            <Kpi
              icon={WifiOff}
              label="동기화 이상"
              value={s.syncGaps == null ? '—' : fmtNumber(s.syncGaps)}
              sub={s.syncGaps == null ? '집계하지 못했습니다' : '센서 사용 중인데 업로드가 끊긴 회원'}
              tone={s.syncGaps ? 'error' : 'neutral'}
              href="/monitor"
            />
            <Kpi icon={CalendarX} label="만료 센서" value={fmtNumber(s.sensors.expired)} tone="neutral" href="/devices?status=expired" />
            <Kpi icon={Package} label="재고" value={fmtNumber(s.sensors.inStock)} sub="아직 사용을 시작하지 않은 센서" tone="info" href="/devices?status=stock" />
            <Kpi
              icon={ShieldAlert}
              label="미확인 SN"
              value={fmtNumber(s.sensors.unverified)}
              sub="확인이 필요한 SN"
              tone={s.sensors.unverified > 0 ? 'warning' : 'neutral'}
              href="/devices?verified=false"
            />
            <Kpi icon={UserX} label="정지 회원" value={fmtNumber(s.users.suspended)} tone="neutral" href="/users?status=suspended" />
            <Kpi icon={Database} label="누적 혈당 데이터" value={fmtNumber(s.totals.dataPoints)} sub="추정치(빠른 집계) · 실제와 조금 다를 수 있음" tone="secondary" href="/data" />
          </div>

          <StatsCharts lineUsers={s.lineUsers} barGlucose={s.barGlucose} pieDevices={s.pieDevices} />

          <Panel title="실시간 기기 현황 (최근 24시간)">
            {summary && (
              <p className="px-4 py-2.5 text-[12.5px] text-base-content/70">
                기기 <b className="text-base-content tabular-nums">{fmtNumber(summary.count)}</b>대 · 평균 활성률{' '}
                <b className="text-base-content tabular-nums">{summary.avgActivityPct}%</b> · 평균 간격{' '}
                <b className="text-base-content tabular-nums">{fmtInterval(summary.avgIntervalSec)}</b>
              </p>
            )}
            <div className="max-h-[420px] overflow-y-auto">
              <DataTable columns={LIVE_COLUMNS} rows={s.devicesLive} rowKey={(d) => d.eqsn} emptyText="최근 24시간 동안 수집된 데이터가 없습니다" />
            </div>
            <p className="px-4 py-2 text-[11.5px] text-base-content/55">활성률 = 24시간 중 혈당이 수집된 분(分)의 비율. 평균 간격은 30분이 넘는 공백을 빼고 계산합니다.</p>
          </Panel>

          <Panel title="최근 임계 초과 (최근 24시간, 최대 20건)">
            <div className="max-h-[420px] overflow-y-auto">
              <DataTable
                columns={ALARM_COLUMNS}
                rows={s.recentAlarms}
                rowKey={(a) => `${a.eqsn}|${a.userEmail}|${a.time}`}
                emptyText="최근 24시간 동안 기준을 벗어난 혈당이 없습니다"
              />
            </div>
            <p className="px-4 py-2 text-[11.5px] text-base-content/55">
              회원이 앱에서 정한 알람 기준으로 판정합니다. 설정이 없으면 기본값(매우 낮음 ≤ 54 · 낮음 ≤ 70 · 높음 ≥ 180)을 씁니다.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
