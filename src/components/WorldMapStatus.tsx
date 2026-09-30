'use client';

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Activity, Cpu, Database, RefreshCw, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useList } from '@/lib/useList';
import { MAP_H, MAP_W, countryCoords, countryLabel, projectLngLat } from '@/lib/countryMeta';
import { PROVIDER_LABEL, fmtDateTime, fmtNumber } from '@/lib/format';
import { ErrorBox, Kpi, PageTitle, Panel, Spinner } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';

export type WorldRegion = {
  countryCode: string;
  users: number;
  activeUsers: number;
  devices: number;
  dataPoints: number;
};

type WorldTotals = { users: number; activeUsers: number; devices: number; dataPoints: number };
type WorldStats = { regions: WorldRegion[]; totals: WorldTotals };

type CountryUser = {
  id: string;
  email: string;
  name: string;
  provider: string;
  countryCode: string;
  createdAt: string;
};

type Callout = {
  region: WorldRegion;
  name: string;
  x: number;
  y: number;
  elbowX: number;
  elbowY: number;
  badgeX: number;
  badgeY: number;
  side: 'left' | 'right';
};

const BADGE_W = 148;
const BADGE_H = 60;

/** 국가 위치에서 꺾은선으로 이어지는 말풍선 자리를 잡는다. 지도 밖으로 나가거나 서로 겹치면 옮긴다. */
function buildCallouts(regions: WorldRegion[]): Callout[] {
  const ranked = [...regions].sort((a, b) => b.users - a.users);
  const placed: Callout[] = [];

  ranked.forEach((region, i) => {
    const { lat, lng } = countryCoords(region.countryCode);
    const { x, y } = projectLngLat(lng, lat);
    const preferRight = lng < 20 || (i % 2 === 0 && lng < 100);
    let side: 'left' | 'right' = preferRight ? 'right' : 'left';
    const diag = 36 + (i % 4) * 10;
    const horiz = 54 + (i % 3) * 12;
    const up = y > MAP_H * 0.55 ? -1 : 1;

    let elbowX = side === 'right' ? x + diag * 0.7 : x - diag * 0.7;
    let elbowY = y + up * diag * 0.55;
    let badgeX = side === 'right' ? elbowX + horiz : elbowX - horiz - BADGE_W;
    let badgeY = elbowY - BADGE_H / 2;

    if (badgeX < 8) {
      side = 'right';
      elbowX = x + diag * 0.7;
      badgeX = elbowX + horiz;
    } else if (badgeX + BADGE_W > MAP_W - 8) {
      side = 'left';
      elbowX = x - diag * 0.7;
      badgeX = elbowX - horiz - BADGE_W;
    }
    badgeY = Math.max(8, Math.min(MAP_H - BADGE_H - 8, badgeY));
    elbowY = badgeY + BADGE_H / 2;

    for (const prev of placed) {
      const overlapX = Math.abs(badgeX - prev.badgeX) < BADGE_W + 6;
      const overlapY = Math.abs(badgeY - prev.badgeY) < BADGE_H + 6;
      if (overlapX && overlapY) {
        badgeY = Math.min(MAP_H - BADGE_H - 8, prev.badgeY + BADGE_H + 10);
        elbowY = badgeY + BADGE_H / 2;
      }
    }

    placed.push({ region, name: countryLabel(region.countryCode), x, y, elbowX, elbowY, badgeX, badgeY, side });
  });

  return placed;
}

const USER_COLUMNS: Column<CountryUser>[] = [
  {
    key: 'email',
    title: '이메일',
    render: (u) => (
      <Link href={`/users/${u.id}`} prefetch={false} className="text-primary hover:underline">
        {u.email}
      </Link>
    ),
  },
  { key: 'name', title: '이름' },
  { key: 'provider', title: '가입 경로', render: (u) => PROVIDER_LABEL[u.provider] || u.provider },
  { key: 'createdAt', title: '가입일', render: (u) => fmtDateTime(u.createdAt) },
];

/** 국가별 회원 목록. 국가가 바뀌면 key 로 새로 만들어 페이지 상태를 초기화한다. */
function CountryUsers({ code }: { code: string }) {
  const list = useList<CountryUser>(`/stats/world/${encodeURIComponent(code)}/users`, {}, { limit: 50 });
  return (
    <DataTable
      columns={USER_COLUMNS}
      rows={list.items}
      rowKey={(u) => u.id}
      loading={list.loading}
      error={list.error}
      emptyText="회원이 없습니다"
      total={list.total}
      page={list.page}
      limit={list.limit}
      onPage={list.setPage}
      onLimit={list.setLimit}
    />
  );
}

export default function WorldMapStatus() {
  const [stats, setStats] = useState<WorldStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapSvg, setMapSvg] = useState('');
  const [modalCode, setModalCode] = useState<string | null>(null);

  // 지도 그림(정적 파일)을 인라인으로 넣어야 테마 색을 입힐 수 있다.
  useEffect(() => {
    let cancelled = false;
    fetch('/maps/world.svg')
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (cancelled) return;
        setMapSvg(text.replace(/<svg\b([^>]*)>/i, '<svg$1 style="width:100%;height:100%;display:block">'));
      })
      .catch(() => {
        if (!cancelled) setMapSvg('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await api<WorldStats>('/stats/world', { signal });
      setStats({ regions: Array.isArray(r.regions) ? r.regions : [], totals: r.totals });
      setError('');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(errorMessage(e));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const regions = useMemo(() => stats?.regions ?? [], [stats]);
  const callouts = useMemo(() => buildCallouts(regions), [regions]);
  const totals = stats?.totals;
  const closeModal = useCallback(() => setModalCode(null), []);

  const regionColumns = useMemo<Column<WorldRegion>[]>(
    () => [
      {
        key: 'countryCode',
        title: '국가',
        render: (r) => (
          <button type="button" className="text-primary font-medium hover:underline" onClick={() => setModalCode(r.countryCode)}>
            {countryLabel(r.countryCode)} <span className="mono text-base-content/55">({r.countryCode})</span>
          </button>
        ),
      },
      { key: 'users', title: '회원', num: true, render: (r) => fmtNumber(r.users) },
      { key: 'activeUsers', title: '활성 (7일)', num: true, render: (r) => fmtNumber(r.activeUsers) },
      { key: 'devices', title: '기기', num: true, render: (r) => fmtNumber(r.devices) },
      { key: 'dataPoints', title: '혈당 건수', num: true, render: (r) => fmtNumber(r.dataPoints) },
    ],
    [],
  );

  const onCalloutKey = (e: KeyboardEvent<SVGGElement>, code: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setModalCode(code);
  };

  return (
    <div>
      <PageTitle
        title="전세계 현황"
        desc="회원 정보의 국가 코드 기준 집계입니다. 활성 = 최근 7일 안에 혈당 데이터가 올라온 회원."
        right={
          <button type="button" className="adm-btn" onClick={() => void load()} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw size={14} />}
            새로고침
          </button>
        }
      />
      <ErrorBox message={error} />

      {!stats ? (
        !error && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} label="회원" value={fmtNumber(totals?.users)} />
            <Kpi icon={Activity} label="활성 (7일)" value={fmtNumber(totals?.activeUsers)} tone="success" />
            <Kpi icon={Cpu} label="기기" value={fmtNumber(totals?.devices)} tone="info" />
            <Kpi icon={Database} label="혈당 건수" value={fmtNumber(totals?.dataPoints)} tone="secondary" />
          </div>

          <Panel title="국가별 분포" bodyClass="p-2 sm:p-3">
            {regions.length === 0 ? (
              <p className="py-12 text-center text-base-content/55">표시할 국가별 데이터가 없습니다.</p>
            ) : (
              <div className="relative w-full" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
                {/* 육지는 테마의 옅은 면색, 호수 등 원본에 흰색으로 칠해진 부분은 카드 배경색으로 바꾼다. */}
                <div
                  className="absolute inset-0 [&_path]:fill-base-300 [&_path]:stroke-base-100 [&_path[style]]:!fill-base-100"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: mapSvg }}
                />
                <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="none" role="group" aria-label="국가별 현황 지도">
                  {callouts.map((c) => {
                    const tipX = c.side === 'right' ? c.badgeX : c.badgeX + BADGE_W;
                    return (
                      <path
                        key={`line-${c.region.countryCode}`}
                        d={`M ${c.x} ${c.y} L ${c.elbowX} ${c.elbowY} L ${tipX} ${c.elbowY}`}
                        fill="none"
                        strokeWidth={1.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="stroke-base-content/50"
                      />
                    );
                  })}
                  {callouts.map((c) => (
                    <g
                      key={c.region.countryCode}
                      role="button"
                      tabIndex={0}
                      aria-label={`${c.name} 회원 ${c.region.users}명, 활성 ${c.region.activeUsers}명, 기기 ${c.region.devices}대 — 회원 목록 보기`}
                      className="cursor-pointer outline-none [&:focus-visible_rect]:stroke-primary [&:hover_rect]:stroke-primary"
                      onClick={() => setModalCode(c.region.countryCode)}
                      onKeyDown={(e) => onCalloutKey(e, c.region.countryCode)}
                    >
                      <circle cx={c.x} cy={c.y} r={4.5} strokeWidth={1.5} className="fill-error stroke-base-100" />
                      <rect x={c.badgeX} y={c.badgeY} width={BADGE_W} height={BADGE_H} rx={7} strokeWidth={1.25} className="fill-base-100 stroke-base-300" />
                      <text x={c.badgeX + 10} y={c.badgeY + 19} fontSize={12} fontWeight={700} className="fill-base-content">
                        {c.name}
                        <tspan fontSize={10} fontWeight={400} className="fill-base-content/60">{` (${c.region.countryCode})`}</tspan>
                      </text>
                      <text x={c.badgeX + 10} y={c.badgeY + 35} fontSize={10.5} className="fill-base-content/80">
                        {`회원 ${fmtNumber(c.region.users)} · 활성 ${fmtNumber(c.region.activeUsers)}`}
                      </text>
                      <text x={c.badgeX + 10} y={c.badgeY + 50} fontSize={10.5} className="fill-base-content/80">
                        {`기기 ${fmtNumber(c.region.devices)}`}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
            <p className="mt-2 px-1 text-[11.5px] text-base-content/55">점이나 말풍선을 누르면 그 국가의 회원 목록이 열립니다. 화면이 좁으면 아래 표를 이용해 주세요.</p>
          </Panel>

          <Panel title="국가별 집계" right={<span className="text-base-content/60">{fmtNumber(regions.length)}개 국가</span>}>
            <DataTable
              columns={regionColumns}
              rows={regions}
              rowKey={(r) => r.countryCode}
              onRowClick={(r) => setModalCode(r.countryCode)}
              selectedKey={modalCode}
              emptyText="표시할 국가별 데이터가 없습니다"
            />
          </Panel>
        </div>
      )}

      <Modal
        open={!!modalCode}
        title={modalCode ? `${countryLabel(modalCode)} (${modalCode}) 회원` : ''}
        onClose={closeModal}
        width={760}
        footer={
          <button type="button" className="adm-btn" onClick={closeModal}>
            닫기
          </button>
        }
      >
        {modalCode && <CountryUsers key={modalCode} code={modalCode} />}
      </Modal>
    </div>
  );
}
