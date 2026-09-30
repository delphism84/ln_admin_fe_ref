'use client';

import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { PageTitle } from '@/components/ui/adm';
import { useAuth } from '@/lib/auth';

type Props = { perm: string; title: string; permLabel: string; children: ReactNode };

/**
 * 권한이 있을 때만 화면(children)을 그린다. 없으면 API 를 부르지 않고 안내만 보여 준다.
 * 실제 차단은 서버가 하며, 여기서는 주소로 직접 들어온 경우의 빈 화면·오류를 막는다.
 */
export default function RequirePerm({ perm, title, permLabel, children }: Props) {
  const { can, loading } = useAuth();
  if (loading) return null;
  if (can(perm)) return <>{children}</>;
  return (
    <div>
      <PageTitle title={title} />
      <div className="adm-card p-8 flex flex-col items-center text-center gap-2">
        <ShieldAlert size={28} className="text-warning" />
        <p className="text-[15px] font-bold">권한이 없습니다</p>
        <p className="text-[12.5px] text-base-content/65">
          이 화면은 <span className="font-semibold">{permLabel}</span> 권한(<span className="mono">{perm}</span>)이 있는 관리자만 볼 수 있습니다. 필요하면 최고관리자에게 요청해 주세요.
        </p>
      </div>
    </div>
  );
}
