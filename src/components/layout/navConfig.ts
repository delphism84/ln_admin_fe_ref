import { Activity, Cpu, Database, LayoutDashboard, Megaphone, Settings, Users, type LucideIcon } from 'lucide-react';

/**
 * 메뉴 정의(한 곳에서 선언 → 사이드바·권한 필터가 공유). games_card 통합어드민의 navConfig 패턴.
 * perm: 이 권한이 없으면 메뉴를 숨긴다(실제 차단은 서버).
 */
export type NavItem = { href: string; label: string; perm?: string; /** 쿼리까지 같아야 활성 */ exact?: boolean };
export type NavGroup = { id: string; label: string; icon: LucideIcon; href?: string; perm?: string; items?: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
    perm: 'dashboard.read',
    items: [
      { href: '/dashboard', label: '전체 현황', exact: true },
      { href: '/dashboard/world', label: '전세계 현황' },
    ],
  },
  { id: 'users', label: '회원 관리', icon: Users, href: '/users', perm: 'users.read' },
  {
    id: 'devices',
    label: '기기 관리',
    icon: Cpu,
    perm: 'devices.read',
    items: [
      { href: '/devices', label: '전체 기기(SN)', exact: true },
      { href: '/devices/ending', label: '종료 예정' },
      { href: '/devices/register', label: 'SN 등록·가져오기', perm: 'devices.write' },
      { href: '/devices/lots', label: '로트' },
      { href: '/devices/qr', label: 'QR 라벨' },
    ],
  },
  { id: 'monitor', label: '동기화 감시', icon: Activity, href: '/monitor', perm: 'monitor.read' },
  { id: 'data', label: '데이터 관리', icon: Database, href: '/data', perm: 'data.read' },
  { id: 'notices', label: '공지사항', icon: Megaphone, href: '/notices', perm: 'notices.read' },
  {
    id: 'system',
    label: '시스템',
    icon: Settings,
    items: [
      { href: '/system/admins', label: '관리자 계정', perm: 'admins.manage' },
      { href: '/system/audit', label: '감사 로그', perm: 'audit.read' },
      { href: '/system/logins', label: '로그인 이력', perm: 'audit.read' },
      { href: '/system/settings', label: '설정', perm: 'dashboard.read' },
    ],
  },
];

export function navForPerms(can: (p: string) => boolean): NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.perm || can(g.perm))
    .map((g) => (g.items ? { ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) } : g))
    .filter((g) => g.href || (g.items && g.items.length > 0));
}

export function itemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function groupActive(pathname: string, g: NavGroup): boolean {
  if (g.href) return pathname === g.href || pathname.startsWith(`${g.href}/`);
  return (g.items || []).some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
}
