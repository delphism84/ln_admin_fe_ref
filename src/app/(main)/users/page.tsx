'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/adm';
import UserListView, { EMPTY_USER_FILTERS, type UserFilters } from '@/components/users/UserListView';

const FILTER_KEYS = Object.keys(EMPTY_USER_FILTERS) as (keyof UserFilters)[];

/** 다른 화면에서 /users?user=…&status=…&sn=… 로 바로 들어올 수 있게 URL 쿼리를 초기 조건으로 쓴다. */
function UsersFromQuery() {
  const params = useSearchParams();
  const initial: UserFilters = { ...EMPTY_USER_FILTERS };
  for (const key of FILTER_KEYS) initial[key] = params.get(key) || '';
  // 쿼리가 바뀌면(다른 딥링크로 이동) 목록을 새 조건으로 다시 만든다.
  return <UserListView key={params.toString()} initial={initial} />;
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      }
    >
      <UsersFromQuery />
    </Suspense>
  );
}
