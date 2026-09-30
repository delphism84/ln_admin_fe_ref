'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 예전 설정 주소. 즐겨찾기가 깨지지 않도록 새 화면으로 넘긴다. */
export default function LegacySettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/system/settings');
  }, [router]);
  return null;
}
