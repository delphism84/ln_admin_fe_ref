'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, CloudOff, RefreshCw, Smartphone, Unplug, WifiOff } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { SYNC_HINT, USER_STATUS, fmtAgo, fmtDateTime, fmtNumber } from '@/lib/format';
import { Field, Kpi, PageTitle, Panel, Pill, Spinner, StatusPill } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { useAutoRefresh } from '@/components/dashboard/useAutoRefresh';

type SyncHint = 'app_silent' | 'never_uploaded' | 'upload_stalled';

type SyncItem = {
  serial: string;
  startAt: string;
  endAt: string;
  userId: string;
  userEmail: string;
  userLabel: string;
  userStatus: string;
  lastUploadAt: string | null;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  gapHours: number;
  hint: SyncHint;
};

type SyncResponse = {
  items: SyncItem[];
  total: number;
  activeSensors: number;
  thresholdHours: number;
  serverTime: string;
};

const REFRESH_MS = 2 * 60 * 1000;
const HOUR_OPTIONS = [1, 3, 6, 12, 24, 48];
const HINTS: SyncHint[] = ['app_silent', 'never_uploaded', 'upload_stalled'];
const HINT_ICON = { app_silent: Smartphone, never_uploaded: CloudOff, upload_stalled: Unplug };

/** 직원이 회원에게 안내할 내용 */
const HINT_ACTION: Record<SyncHint, string> = {
  app_silent: '회원에게 앱을 실행하고 다시 로그인하도록 안내합니다.',
  never_uploaded: '센서 등록 직후인지 확인하고, 앱을 열어 센서와 연결되어 있는지 확인하도록 안내합니다.',
  upload_stalled: '센서 연결 상태(블루투스·센서 부착)를 확인하도록 안내합니다.',
};

const SORT_VALUE: Record<string, (r: SyncItem) => number> = {
  gapHours: (r) => r.gapHours,
  lastUploadAt: (r) => toMs(r.lastUploadAt),
  lastSeenAt: (r) => toMs(r.lastSeenAt),
  lastLoginAt: (r) => toMs(r.lastLoginAt),
  startAt: (r) => toMs(r.startAt),
  endAt: (r) => toMs(r.endAt),
};

/** 기록이 없는 값은 가장 오래된 것으로 친다 */
function toMs(v: string | null): number {
  const t = v ? new Date(v).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/** 25.5 → "1일 1시간", 7.4 → "7시간" */
function fmtGap(hours: number): string {
  const h = Math.floor(hours);
  if (h < 1) return '1시간 미만';
  return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`;
}

function TimeCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-base-content/50">기록 없음</span>;
  return (
    <span title={fmtAgo(value)}>
      {fmtDateTime(value)} <span className="text-base-content/50">({fmtAgo(value)})</span>
    </span>
  );
}

const COLUMNS: Column<SyncItem>[] = [
  {
    key: 'user',
    title: '회원',
    render: (r) => (
      <div className="flex items-center gap-1.5">
        <Link href={`/users/${r.userId}`} prefetch={false} className="text-primary font-medium hover:underline">
          {r.userEmail}
        </Link>
        {r.userLabel && r.userLabel !== r.userEmail && <span className="text-base-content/55">{r.userLabel}</span>}
        {r.userStatus !== 'active' && <StatusPill map={USER_STATUS} value={r.userStatus} />}
      </div>
    ),
  },
  {
    key: 'serial',
    title: 'S/N',
    render: (r) => (
      <Link href={`/devices/${encodeURIComponent(r.serial)}`} prefetch={false} className="mono text-primary hover:underline">
        {r.serial}
      </Link>
    ),
  },
  {
    key: 'hint',
    title: '상태 유형',
    render: (r) => {
      const h = SYNC_HINT[r.hint];
      return (
        <Pill tone={h?.tone || 'gray'} title={h?.desc} dot>
          {h?.text || r.hint}
        </Pill>
      );
    },
  },
  { key: 'gapHours', title: '끊긴 시간', sortKey: 'gapHours', num: true, render: (r) => <b>{fmtGap(r.gapHours)}</b> },
  { key: 'lastUploadAt', title: '마지막 업로드', sortKey: 'lastUploadAt', render: (r) => <TimeCell value={r.lastUploadAt} /> },
  { key: 'lastSeenAt', title: '마지막 접속', sortKey: 'lastSeenAt', render: (r) => <TimeCell value={r.lastSeenAt} /> },
  { key: 'lastLoginAt', title: '마지막 로그인', sortKey: 'lastLoginAt', render: (r) => fmtDateTime(r.lastLoginAt) },
  { key: 'startAt', title: '센서 시작', sortKey: 'startAt', render: (r) => fmtDateTime(r.startAt) },
  { key: 'endAt', title: '센서 만료', sortKey: 'endAt', render: (r) => fmtDateTime(r.endAt) },
];

export default function MonitorPage() {
  /** null = 서버 설정값(syncGapHours)을 그대로 쓴다 */
  const [hours, setHours] = useState<number | null>(null);
  const [data, setData] = useState<SyncResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hintFilter, setHintFilter] = useState<SyncHint | ''>('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('gapHours:desc');
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const r = await api<SyncResponse>('/monitor/sync', { query: { hours } });
      if (seq !== requestSeq.current) return;
      setData(r);
      setError('');
    } catch (e) {
      if (seq === requestSeq.current) setError(errorMessage(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
    return () => {
      // 화면을 떠났거나 기준 시간이 바뀌면 진행 중이던 응답은 버린다.
      requestSeq.current += 1;
    };
  }, [load]);

  useAutoRefresh(load, REFRESH_MS);

  const items = useMemo(() => data?.items ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<SyncHint, number> = { app_silent: 0, never_uploaded: 0, upload_stalled: 0 };
    for (const it of items) if (it.hint in c) c[it.hint] += 1;
    return c;
  }, [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [field, dir] = sort.split(':');
    const value = SORT_VALUE[field] || SORT_VALUE.gapHours;
    const sign = dir === 'asc' ? 1 : -1;
    return items
      .filter((r) => (!hintFilter || r.hint === hintFilter) && (!q || r.userEmail.toLowerCase().includes(q) || r.serial.toLowerCase().includes(q)))
      .sort((a, b) => sign * (value(a) - value(b)) || b.gapHours - a.gapHours);
  }, [items, hintFilter, search, sort]);

  const selectedHours = hours ?? data?.thresholdHours ?? null;
  const hourOptions = selectedHours != null && !HOUR_OPTIONS.includes(selectedHours) ? [...HOUR_OPTIONS, selectedHours].sort((a, b) => a - b) : HOUR_OPTIONS;
  const filtered = !!hintFilter || !!search.trim();

  return (
    <div>
      <PageTitle
        title="동기화 감시"
        desc="센서를 사용 중인데 기준 시간 넘게 혈당이 서버로 올라오지 않는 회원입니다. 앱 로그인이 조용히 만료됐거나 센서 연결이 끊긴 경우가 여기에 나타납니다."
        right={
          <>
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-base-content/70">
              기준 시간
              <select
                className="adm-input !w-auto"
                value={selectedHours ?? ''}
                disabled={selectedHours == null}
                onChange={(e) => setHours(Number(e.target.value))}
              >
                {selectedHours == null && <option value="">—</option>}
                {hourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}시간
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="adm-btn" onClick={() => void load()} disabled={loading}>
              {loading ? <Spinner /> : <RefreshCw size={14} />}
              새로고침
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <Kpi icon={Activity} label="사용 중 센서" value={fmtNumber(data?.activeSensors)} sub="회원에게 등록된 유효 센서" tone="success" />
          <Kpi
            icon={WifiOff}
            label="동기화 이상"
            value={fmtNumber(data?.total)}
            sub={data ? `${data.thresholdHours}시간 넘게 업로드 없음` : undefined}
            tone={data?.total ? 'error' : 'neutral'}
          />
          {HINTS.map((h) => (
            <Kpi
              key={h}
              icon={HINT_ICON[h]}
              label={SYNC_HINT[h].text}
              value={data ? fmtNumber(counts[h]) : '—'}
              tone={!counts[h] ? 'neutral' : SYNC_HINT[h].tone === 'red' ? 'error' : 'warning'}
            />
          ))}
        </div>

        <Panel title="상태 유형과 안내 방법" bodyClass="p-4">
          <ul className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {HINTS.map((h) => (
              <li key={h} className="min-w-0">
                <Pill tone={SYNC_HINT[h].tone} dot>
                  {SYNC_HINT[h].text}
                </Pill>
                <p className="mt-1.5 text-[12.5px] text-base-content/80">{SYNC_HINT[h].desc}</p>
                <p className="mt-1 text-[12.5px]">
                  <span className="font-semibold text-base-content/60">조치 </span>
                  {HINT_ACTION[h]}
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="adm-card p-3 grid grid-cols-1 sm:grid-cols-[200px_minmax(0,320px)_auto] gap-3 items-end">
          <Field label="상태 유형">
            <select className="adm-input" value={hintFilter} onChange={(e) => setHintFilter(e.target.value as SyncHint | '')}>
              <option value="">전체</option>
              {HINTS.map((h) => (
                <option key={h} value={h}>
                  {SYNC_HINT[h].text} ({counts[h]})
                </option>
              ))}
            </select>
          </Field>
          <Field label="이메일 · S/N 검색">
            <input className="adm-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="입력하는 대로 걸러집니다" />
          </Field>
          <button
            type="button"
            className="adm-btn justify-self-start"
            disabled={!filtered}
            onClick={() => {
              setHintFilter('');
              setSearch('');
            }}
          >
            초기화
          </button>
        </div>

        <Panel
          title="동기화 이상 목록"
          right={<span className="text-base-content/60">{filtered ? `${fmtNumber(rows.length)} / ${fmtNumber(items.length)}건` : `${fmtNumber(items.length)}건`}</span>}
        >
          {data && <p className="px-4 pt-2.5 pb-2 text-[11.5px] text-base-content/55">{fmtDateTime(data.serverTime, true)} 기준 · 2분마다 자동 새로고침</p>}
          <DataTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(r) => r.serial}
            loading={loading}
            error={error}
            sort={sort}
            onSort={setSort}
            emptyText={filtered ? '조건에 맞는 항목이 없습니다' : '동기화 이상이 없습니다. 사용 중인 센서가 모두 정상적으로 업로드하고 있습니다.'}
          />
        </Panel>
      </div>
    </div>
  );
}
