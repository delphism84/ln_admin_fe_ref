'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Query } from './api';

export type ListState<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  sort: string;
  loading: boolean;
  error: string;
  /** 서버가 목록과 함께 주는 부가 값(validityDays 등) */
  extra: Record<string, any>;
  setPage: (p: number) => void;
  setLimit: (n: number) => void;
  setSort: (s: string) => void;
  reload: () => void;
};

/**
 * 서버 페이징 목록 훅. filters 가 바뀌면 1페이지로 돌아가 다시 조회한다.
 * 화면은 처음 열 때 바로 조회한다(예전 화면은 "조회"를 눌러야 목록이 나왔다).
 */
export function useList<T = any>(path: string, filters: Query = {}, opts: { limit?: number; sort?: string; enabled?: boolean } = {}): ListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(opts.limit || 25);
  const [sort, setSortState] = useState(opts.sort || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [tick, setTick] = useState(0);
  const enabled = opts.enabled !== false;

  const filterKey = JSON.stringify(filters);
  const prevKey = useRef(filterKey);

  useEffect(() => {
    if (prevKey.current !== filterKey) {
      prevKey.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return; // page 변경이 다시 이 effect 를 부른다
      }
    }
    if (!enabled) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    api<any>(path, { query: { ...JSON.parse(filterKey), page, limit, sort }, signal: ctrl.signal })
      .then((r) => {
        const { items: rows, total: t, page: _p, limit: _l, ...rest } = r || {};
        setItems(Array.isArray(rows) ? rows : []);
        setTotal(Number(t) || 0);
        setExtra(rest);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setError(errorMessage(e));
        setItems([]);
        setTotal(0);
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, filterKey, page, limit, sort, tick, enabled]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setLimit = useCallback((n: number) => {
    setLimitState(n);
    setPage(1);
  }, []);
  const setSort = useCallback((s: string) => {
    setSortState(s);
    setPage(1);
  }, []);

  return { items, total, page, limit, sort, loading, error, extra, setPage, setLimit, setSort, reload };
}
