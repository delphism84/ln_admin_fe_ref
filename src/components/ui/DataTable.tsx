'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyRow, Spinner } from './adm';
import { fmtNumber } from '@/lib/format';

export type Column<T> = {
  key: string;
  title: ReactNode;
  render?: (row: T) => ReactNode;
  /** 서버 정렬 필드명. 있으면 헤더를 눌러 정렬한다. */
  sortKey?: string;
  className?: string;
  num?: boolean;
  width?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  /** 'field:asc|desc' */
  sort?: string;
  onSort?: (s: string) => void;
  /** 체크박스 선택 */
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  // 페이징(서버)
  total?: number;
  page?: number;
  limit?: number;
  onPage?: (p: number) => void;
  onLimit?: (n: number) => void;
};

/**
 * 공통 목록 표: 서버 페이징·정렬, 행 선택, 체크박스 선택.
 * 참고 어드민에는 공통 표가 없어 화면마다 표를 따로 짰는데, 여기서는 하나로 통일한다.
 */
export default function DataTable<T>({
  columns, rows, rowKey, loading, error, emptyText, onRowClick, selectedKey,
  sort, onSort, selected, onSelectedChange, total, page = 1, limit = 25, onPage, onLimit,
}: Props<T>) {
  const [sortField, sortDir] = (sort || '').split(':');
  const selectable = !!selected && !!onSelectedChange;
  const allKeys = rows.map(rowKey);
  const allChecked = selectable && allKeys.length > 0 && allKeys.every((k) => selected!.has(k));
  const colSpan = columns.length + (selectable ? 1 : 0);

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) allKeys.forEach((k) => next.delete(k));
    else allKeys.forEach((k) => next.add(k));
    onSelectedChange!(next);
  };
  const toggleOne = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectedChange!(next);
  };
  const clickSort = (key: string) => {
    if (!onSort) return;
    onSort(sortField === key ? `${key}:${sortDir === 'asc' ? 'desc' : 'asc'}` : `${key}:desc`);
  };

  const pages = total != null ? Math.max(1, Math.ceil(total / limit)) : 1;

  return (
    <div className="min-w-0">
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
                  <input type="checkbox" className="checkbox checkbox-xs checkbox-primary align-middle" checked={allChecked} onChange={toggleAll} aria-label="전체 선택" />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={c.num ? 'num' : ''}
                  aria-sort={c.sortKey && sortField === c.sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortKey && onSort ? (
                    // 버튼이라 키보드(Tab·Enter)로도 정렬할 수 있다.
                    <button type="button" className="inline-flex items-center gap-1 font-semibold hover:text-base-content" onClick={() => clickSort(c.sortKey!)}>
                      {c.title}
                      {sortField === c.sortKey && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ) : (
                    c.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <EmptyRow colSpan={colSpan} text={error} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={colSpan} text={loading ? '불러오는 중…' : emptyText} />
            ) : (
              rows.map((row) => {
                const k = rowKey(row);
                return (
                  <tr
                    key={k}
                    className={`${onRowClick ? 'is-clickable' : ''} ${selectedKey === k ? 'is-selected' : ''}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="checkbox checkbox-xs checkbox-primary align-middle" checked={selected!.has(k)} onChange={() => toggleOne(k)} aria-label="선택" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className || ''}`}>
                        {c.render ? c.render(row) : ((row as any)[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total != null && onPage && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[12.5px] text-base-content/70">
          <div className="flex items-center gap-2">
            <span>
              총 <b className="text-base-content tabular-nums">{fmtNumber(total)}</b>건
            </span>
            {loading && <Spinner />}
            {selectable && selected!.size > 0 && <span className="text-primary font-semibold">{selected!.size}건 선택</span>}
          </div>
          <div className="flex items-center gap-2">
            {onLimit && (
              <select className="adm-input !h-7 !w-auto !px-2 text-[12px]" value={limit} onChange={(e) => onLimit(Number(e.target.value))} aria-label="페이지당 행 수">
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}개씩
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="adm-btn adm-btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="이전 페이지">
              <ChevronLeft size={14} />
            </button>
            <span className="tabular-nums">
              {page} / {pages}
            </span>
            <button type="button" className="adm-btn adm-btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="다음 페이지">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
