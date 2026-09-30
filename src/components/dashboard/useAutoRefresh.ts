'use client';

import { useEffect, useRef } from 'react';

/**
 * 주기적 새로고침. 탭이 가려져 있으면 건너뛰고, 화면을 떠나면 타이머를 정리한다.
 * fn 은 최신 것을 부르므로 의존성 때문에 타이머가 다시 걸리지 않는다.
 */
export function useAutoRefresh(fn: () => void, everyMs: number) {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      latest.current();
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
}
