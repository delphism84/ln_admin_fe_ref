'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, errorMessage } from '@/lib/api';
import type { LotsResponse } from './types';

const EMPTY_LOTS: LotsResponse = {
  items: [],
  unassigned: { total: 0, registered: 0, active: 0, blocked: 0, shipped: 0, noMac: 0 },
};

/** 로트 목록(+통계). 필터·datalist·로트 화면이 같이 쓴다. */
export function useLots() {
  const [data, setData] = useState<LotsResponse>(EMPTY_LOTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    api<LotsResponse>('/lots', { signal: ctrl.signal })
      .then((r) => setData({ items: r.items ?? [], unassigned: r.unassigned ?? EMPTY_LOTS.unassigned }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(errorMessage(e));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { lots: data.items, unassigned: data.unassigned, loading, error, reload };
}

/**
 * QR 문자열들을 PNG data URL 로 만든다. 반환값은 { [문자열]: dataUrl }.
 * 문자열은 서버가 준 payload 를 그대로 쓴다(앱이 읽는 형식이라 FE 가 조립하지 않는다).
 */
export function useQrImages(payloads: string[], width = 480): Record<string, string> {
  const [images, setImages] = useState<Record<string, string>>({});
  const key = JSON.stringify(payloads);

  useEffect(() => {
    let cancelled = false;
    const unique = [...new Set(JSON.parse(key) as string[])].filter(Boolean);
    Promise.all(
      unique.map((p) =>
        QRCode.toDataURL(p, { errorCorrectionLevel: 'M', margin: 1, width })
          .then((url): [string, string] => [p, url])
          .catch((): [string, string] => [p, '']),
      ),
    ).then((pairs) => {
      if (!cancelled) setImages(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [key, width]);

  return images;
}
