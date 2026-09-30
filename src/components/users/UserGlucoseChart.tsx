'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import { Panel, Spinner } from '@/components/ui/adm';
import type { GlucoseResponse, GlucoseThresholds, UserDevice } from './types';

const HOUR = 60 * 60 * 1000;
const RANGES = [
  { key: '24h', label: '24시간', ms: 24 * HOUR },
  { key: '3d', label: '3일', ms: 3 * 24 * HOUR },
  { key: '7d', label: '7일', ms: 7 * 24 * HOUR },
  { key: '14d', label: '14일', ms: 14 * 24 * HOUR },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

// daisyUI 테마 색(라이트/다크 자동 전환)
const COLOR_LINE = 'oklch(var(--p))';
const COLOR_LOW = 'oklch(var(--er))';
const COLOR_HIGH = 'oklch(var(--wa))';
const COLOR_GRID = 'oklch(var(--bc) / 0.12)';
const COLOR_AXIS = 'oklch(var(--bc) / 0.6)';

type Loaded = { data: GlucoseResponse; fromMs: number; toMs: number };

/** 혈당 그래프. 서버가 구간이 길면 버킷 평균으로 줄여 준다(downsampled). */
export default function UserGlucoseChart({ userId, devices, thresholds }: { userId: string; devices: UserDevice[]; thresholds: GlucoseThresholds }) {
  const [range, setRange] = useState<RangeKey>('24h');
  const [eqsn, setEqsn] = useState('');
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    const span = RANGES.find((r) => r.key === range)!.ms;
    const toMs = Date.now();
    const fromMs = toMs - span;
    setLoading(true);
    setError('');
    api<GlucoseResponse>(`/users/${userId}/glucose`, {
      query: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), eqsn },
      signal: ctrl.signal,
    })
      .then((data) => setLoaded({ data, fromMs, toMs }))
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setLoaded(null);
        setError(errorMessage(e));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [userId, range, eqsn, tick]);

  const points = loaded?.data.points ?? [];
  const shortSpan = loaded ? loaded.toMs - loaded.fromMs <= 24 * HOUR : true;
  const fmtTick = (t: number) => (shortSpan ? fmtDateTime(t).slice(11) : fmtDateTime(t).slice(5));

  return (
    <Panel
      title="혈당 그래프"
      right={
        <>
          {loading && <Spinner />}
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm !px-1.5" onClick={() => setTick((n) => n + 1)} aria-label="그래프 새로 고침" title="새로 고침">
            <RefreshCw size={14} />
          </button>
        </>
      }
      bodyClass="p-4"
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="조회 기간">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`adm-btn adm-btn-sm ${range === r.key ? 'adm-btn-primary' : ''}`}
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {devices.length > 1 && (
          <select className="adm-input !h-7 !w-auto !px-2 text-[12px] mono" value={eqsn} onChange={(e) => setEqsn(e.target.value)} aria-label="센서 선택">
            <option value="">전체 센서</option>
            {devices.map((d) => (
              <option key={d.id} value={d.serial}>
                {d.serial}
              </option>
            ))}
          </select>
        )}
        {loaded && (
          <span className="ml-auto text-[12px] text-base-content/60">
            측정 {fmtNumber(loaded.data.total)}건{loaded.data.downsampled && ' · 구간 평균으로 축약 표시'}
          </span>
        )}
      </div>

      <div className="h-[300px]">
        {error ? (
          <div className="h-full flex items-center justify-center text-[13px] text-error">{error}</div>
        ) : !loaded ? (
          <div className="h-full flex items-center justify-center text-[13px] text-base-content/55">불러오는 중…</div>
        ) : points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[13px] text-base-content/55">이 기간에 측정된 혈당 데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLOR_GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[loaded.fromMs, loaded.toMs]}
                tickFormatter={fmtTick}
                tick={{ fontSize: 11, fill: COLOR_AXIS }}
                stroke={COLOR_GRID}
                minTickGap={48}
              />
              <YAxis
                width={44}
                domain={[(min: number) => Math.min(40, Math.floor(min / 10) * 10), (max: number) => Math.max(250, Math.ceil(max / 10) * 10)]}
                tick={{ fontSize: 11, fill: COLOR_AXIS }}
                stroke={COLOR_GRID}
                label={{ value: 'mg/dL', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLOR_AXIS }}
              />
              <Tooltip
                isAnimationActive={false}
                labelFormatter={(t) => `${fmtDateTime(Number(t))} (한국시간)`}
                formatter={(v) => [`${v} mg/dL`, loaded.data.downsampled ? '구간 평균' : '혈당']}
                contentStyle={{ fontSize: 12, borderRadius: 8, background: 'oklch(var(--b1))', borderColor: 'oklch(var(--b3))' }}
              />
              <ReferenceLine y={thresholds.low} stroke={COLOR_LOW} strokeDasharray="4 4" label={{ value: `저 ${thresholds.low}`, position: 'insideBottomRight', fontSize: 11, fill: COLOR_LOW }} />
              <ReferenceLine y={thresholds.high} stroke={COLOR_HIGH} strokeDasharray="4 4" label={{ value: `고 ${thresholds.high}`, position: 'insideTopRight', fontSize: 11, fill: COLOR_HIGH }} />
              <Line type="linear" dataKey="v" stroke={COLOR_LINE} strokeWidth={1.6} dot={points.length <= 2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-base-content/55">
        시간축은 한국시간, 값은 mg/dL 입니다. 점선은 이 회원의 저혈당({thresholds.low})·고혈당({thresholds.high}) 기준입니다.
      </p>
    </Panel>
  );
}
