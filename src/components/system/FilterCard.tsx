'use client';

import type { FormEvent, ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';

/** 목록 화면 공통 필터 묶음: 입력 → 조회(Enter 포함) / 초기화. */
export default function FilterCard({ children, onSearch, onReset }: { children: ReactNode; onSearch: () => void; onReset: () => void }) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch();
  };
  return (
    <form onSubmit={submit} className="adm-card no-print p-3 mb-3 flex flex-wrap items-end gap-3">
      {children}
      <div className="flex items-center gap-2">
        <button type="submit" className="adm-btn adm-btn-primary">
          <Search size={14} />
          조회
        </button>
        <button type="button" className="adm-btn" onClick={onReset}>
          <RotateCcw size={14} />
          초기화
        </button>
      </div>
    </form>
  );
}
