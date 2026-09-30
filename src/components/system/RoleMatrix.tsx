'use client';

import { Check } from 'lucide-react';
import { Panel } from '@/components/ui/adm';
import { ROLE_LABEL } from '@/lib/format';

/** GET /roles 응답 */
export type RolesResponse = { roles: string[]; permissions: string[]; rolePerms: Record<string, string[]> };

const PERM_LABEL: Record<string, string> = {
  'dashboard.read': '대시보드 조회',
  'users.read': '회원 조회',
  'users.write': '회원 수정·정지',
  'users.support': '비밀번호 재설정·강제 로그아웃',
  'users.delete': '회원 탈퇴·삭제',
  'devices.read': '기기 조회',
  'devices.write': '기기 등록·수정·차단·소유권',
  'devices.delete': '기기·로트 삭제',
  'data.read': '데이터 조회',
  'data.export': '내보내기',
  'data.delete': '데이터 삭제',
  'monitor.read': '동기화 감시',
  'notices.read': '공지 조회',
  'notices.write': '공지 작성',
  'audit.read': '감사·로그인 기록',
  'admins.manage': '관리자 계정',
  'settings.manage': '시스템 설정',
  'system.reset': '전체 초기화',
};

/** 역할(열) × 권한(행) 표. 서버의 rolePerms 를 그대로 그린다. */
export default function RoleMatrix({ data, loading, error }: { data: RolesResponse | null; loading: boolean; error: string }) {
  return (
    <Panel title="역할별 권한">
      {!data ? (
        <p className="p-6 text-center text-[13px] text-base-content/55">{error || (loading ? '불러오는 중…' : '데이터가 없습니다')}</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">권한</th>
                {data.roles.map((r) => (
                  <th key={r} scope="col" className="!text-center">
                    {ROLE_LABEL[r] || r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr key={p}>
                  <td>
                    <span className="font-semibold">{PERM_LABEL[p] || p}</span>
                    <span className="ml-2 mono text-[11px] text-base-content/50">{p}</span>
                  </td>
                  {data.roles.map((r) => {
                    const has = (data.rolePerms[r] || []).includes(p);
                    return (
                      <td key={r} className="!text-center">
                        {has ? <Check size={15} className="inline text-success" aria-label="허용" /> : <span className="text-base-content/25" aria-label="없음">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
