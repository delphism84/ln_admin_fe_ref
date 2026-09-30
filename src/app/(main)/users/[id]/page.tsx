'use client';

import { useParams } from 'next/navigation';
import UserDetailView from '@/components/users/UserDetailView';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 회원이 바뀌면 화면 상태(그래프 기간, 메모 입력 등)를 새로 시작한다.
  return <UserDetailView key={id} userId={id} />;
}
