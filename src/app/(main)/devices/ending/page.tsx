'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api, errorMessage, getToken } from '@/lib/api';
import { fmtDateTime, fmtMac, fmtNumber } from '@/lib/format';
import { ErrorBox, PageTitle, Panel, Pill, type PillTone } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import DeviceEndingModal, { fmtCountdown, remainingSec, type EndingDevice } from '@/components/DeviceEndingModal';

/** GET /devices/ending-soon 응답. 웹소켓은 같은 내용에 type 을 붙여 1초마다 보낸다. */
type EndingPayload = {
  items: EndingDevice[];
  total: number;
  validityDays: number;
  windowHours: number;
  serverTime: string;
};

type ConnState = 'connecting' | 'live' | 'reconnecting' | 'stopped';

const CONN_LABEL: Record<ConnState, { text: string; tone: PillTone }> = {
  connecting: { text: '실시간 연결 중…', tone: 'gray' },
  live: { text: '실시간', tone: 'green' },
  reconnecting: { text: '실시간 연결 끊김 — 재연결 중', tone: 'amber' },
  stopped: { text: '실시간 연결 중지', tone: 'red' },
};

const MAX_BACKOFF_MS = 30 * 1000;

/** API 주소가 다른 호스트로 잡혀 있으면(NEXT_PUBLIC_API_BASE_URL) 그쪽으로, 아니면 지금 페이지의 호스트로 붙는다. */
function wsUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const origin = /^https?:\/\//i.test(base) ? base : `${window.location.origin}${base}`;
  return `${origin.replace(/^http/i, 'ws')}/api/admin/ws/devices-ending?token=${encodeURIComponent(token)}`;
}

function isEndingMessage(msg: unknown): msg is EndingPayload {
  const m = msg as { type?: unknown; items?: unknown } | null;
  return !!m && m.type === 'devices_ending_soon' && Array.isArray(m.items);
}

export default function DevicesEndingPage() {
  const [data, setData] = useState<EndingPayload | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<EndingDevice | null>(null);

  // 목록 수신: 처음 한 번은 HTTP 로 받고, 이후 웹소켓으로 갱신한다.
  // 소켓이 끊기면 HTTP 로 한 번 확인한 뒤 점점 간격을 늘려(최대 30초) 다시 붙는다.
  // 확인 요청이 인증·권한 오류면 재연결을 멈춘다 — 만료된 토큰으로 계속 두드리지 않기 위해서다.
  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;

    const apply = (p: EndingPayload) => {
      setData(p);
      const server = new Date(p.serverTime).getTime();
      if (!Number.isNaN(server)) setClockOffsetMs(server - Date.now());
    };

    /** @returns 계속 재연결해도 되는지 */
    const fetchOnce = async (): Promise<boolean> => {
      try {
        const r = await api<EndingPayload>('/devices/ending-soon');
        if (closed) return false;
        apply(r);
        setError('');
        return true;
      } catch (e) {
        if (closed) return false;
        setError(errorMessage(e));
        return !(e instanceof ApiError && (e.status === 401 || e.status === 403));
      }
    };

    const onDown = () => {
      if (closed) return;
      setConn('reconnecting');
      void fetchOnce().then((ok) => {
        if (closed) return;
        if (!ok) {
          setConn('stopped');
          return;
        }
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      });
    };

    const connect = () => {
      if (closed) return;
      const token = getToken();
      if (!token) {
        setConn('stopped');
        return;
      }
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl(token));
      } catch {
        onDown();
        return;
      }
      socket = ws;
      ws.onopen = () => {
        attempt = 0;
        setConn('live');
        setError('');
      };
      ws.onmessage = (ev) => {
        try {
          const msg: unknown = JSON.parse(String(ev.data));
          if (isEndingMessage(msg)) apply(msg);
        } catch {
          /* JSON 이 아닌 프레임은 무시 */
        }
      };
      ws.onclose = () => {
        if (socket === ws) socket = null;
        onDown();
      };
    };

    void fetchOnce().then((ok) => {
      if (closed) return;
      if (ok) connect();
      else setConn('stopped');
    });

    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, []);

  // 카운트다운은 서버 푸시와 무관하게 1초마다 직접 계산한다(연결이 끊겨도 계속 줄어든다).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const serverNow = now + clockOffsetMs;
  const rows = useMemo(
    () =>
      (data?.items ?? [])
        .map((d) => ({ device: d, remain: remainingSec(d.endAt, serverNow) ?? 0 }))
        .filter((r) => r.remain > 0)
        .sort((a, b) => a.remain - b.remain),
    [data, serverNow],
  );

  const closeModal = useCallback(() => setSelected(null), []);

  const columns = useMemo<Column<(typeof rows)[number]>[]>(
    () => [
      {
        key: 'remain',
        title: '잔여 시간',
        render: (r) => <span className={`font-bold tabular-nums ${r.remain < 3600 ? 'text-error' : 'text-warning'}`}>{fmtCountdown(r.remain)}</span>,
      },
      {
        key: 'serial',
        title: 'S/N',
        render: (r) => (
          <button
            type="button"
            className="mono text-primary hover:underline"
            aria-label={`${r.device.serial} 상세 열기`}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(r.device);
            }}
          >
            {r.device.serial}
          </button>
        ),
      },
      { key: 'bleMac', title: 'MAC', render: (r) => <span className="mono">{fmtMac(r.device.bleMac)}</span> },
      { key: 'userLabel', title: '회원', render: (r) => r.device.userLabel },
      { key: 'userEmail', title: '이메일', render: (r) => r.device.userEmail },
      { key: 'startAt', title: '시작', render: (r) => fmtDateTime(r.device.startAt) },
      { key: 'endAt', title: '종료 예정', render: (r) => fmtDateTime(r.device.endAt) },
    ],
    [],
  );

  const label = CONN_LABEL[conn];

  return (
    <div>
      <PageTitle
        title="종료 예정 기기"
        desc={
          data
            ? `센서 유효기간(${data.validityDays}일) 기준으로 종료까지 ${data.windowHours}시간 이내인 기기입니다. 잔여 시간이 짧은 순으로 보여 줍니다.`
            : '유효기간 종료가 임박한 기기입니다. 잔여 시간이 짧은 순으로 보여 줍니다.'
        }
        right={
          <span role="status" aria-live="polite">
            <Pill tone={label.tone} dot>
              {label.text}
            </Pill>
          </span>
        }
      />
      <ErrorBox message={error} />
      {conn === 'stopped' && !error && <ErrorBox message="실시간 연결을 시작하지 못했습니다. 화면을 새로 열어 주세요." />}

      <Panel title="종료 예정 목록" right={<span className="text-base-content/60">총 {fmtNumber(rows.length)}대 · 행을 누르면 상세</span>}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.device.id}
          loading={!data && !error}
          onRowClick={(r) => setSelected(r.device)}
          selectedKey={selected?.id}
          emptyText={data ? `${data.windowHours}시간 이내에 종료되는 기기가 없습니다` : undefined}
        />
      </Panel>

      <DeviceEndingModal device={selected} open={!!selected} onClose={closeModal} validityDays={data?.validityDays ?? null} clockOffsetMs={clockOffsetMs} />
    </div>
  );
}
