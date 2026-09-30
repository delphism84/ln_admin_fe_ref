'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, KeyRound, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/format';
import { groupActive, itemActive, navForPerms } from './navConfig';
import { Spinner } from '@/components/ui/adm';

const THEME_KEY = 'empecs_admin_theme';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    const initial = saved === 'dark' || saved === 'light' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  };
  return { theme, toggle };
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || '';
  const { can } = useAuth();
  const groups = navForPerms(can);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // 현재 화면이 속한 그룹은 펼쳐 둔다.
  useEffect(() => {
    const g = groups.find((x) => x.items && groupActive(pathname, x));
    if (g) setOpen((o) => (o[g.id] ? o : { ...o, [g.id]: true }));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav className="flex flex-col h-full bg-neutral text-neutral-content">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10 shrink-0">
        <span className="w-7 h-7 rounded-lg bg-primary text-primary-content flex items-center justify-center text-[13px] font-black">CG</span>
        <span className="font-extrabold tracking-tight">EMPECS CGMS</span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((g) => {
          const active = groupActive(pathname, g);
          const Icon = g.icon;
          if (g.href) {
            return (
              <Link
                key={g.id}
                href={g.href}
                prefetch={false}
                onClick={onNavigate}
                className={`mx-2 my-0.5 flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-semibold ${active ? 'bg-primary text-primary-content' : 'text-neutral-content/80 hover:bg-white/10'}`}
              >
                <Icon size={16} />
                {g.label}
              </Link>
            );
          }
          const isOpen = !!open[g.id];
          return (
            <div key={g.id} className="my-0.5">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}
                className={`mx-2 w-[calc(100%-16px)] flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-semibold ${active ? 'text-white' : 'text-neutral-content/80'} hover:bg-white/10`}
                aria-expanded={isOpen}
              >
                <Icon size={16} />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="mt-0.5 mb-1">
                  {g.items!.map((i) => {
                    const on = itemActive(pathname, i);
                    return (
                      <Link
                        key={i.href}
                        href={i.href}
                        prefetch={false}
                        onClick={onNavigate}
                        className={`mx-2 flex items-center h-8 pl-10 pr-3 rounded-lg text-[12.5px] ${on ? 'bg-primary text-primary-content font-semibold' : 'text-neutral-content/70 hover:bg-white/10'}`}
                      >
                        {i.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { admin, loading, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawer(false), [pathname]);

  if (loading || !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="no-print hidden lg:block w-[232px] shrink-0 sticky top-0 h-screen">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="no-print lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
          <div className="w-[240px] h-full">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
          <button type="button" className="flex-1 bg-neutral/55" onClick={() => setDrawer(false)} aria-label="메뉴 닫기" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 h-14 flex items-center gap-2 px-3 sm:px-5 bg-base-100 border-b border-base-300">
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm lg:hidden !px-1.5" onClick={() => setDrawer((v) => !v)} aria-label="메뉴">
            {drawer ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex-1" />
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm !px-2" onClick={toggle} aria-label="테마 전환" title="라이트/다크 전환">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="dropdown dropdown-end">
            <button type="button" tabIndex={0} className="adm-btn adm-btn-ghost !h-10 !px-2 gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[12px] font-bold">
                {(admin.name || admin.username).slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-[12.5px] font-bold">{admin.name || admin.username}</span>
                <span className="text-[11px] text-base-content/60">{ROLE_LABEL[admin.role] || admin.role}</span>
              </span>
            </button>
            <ul tabIndex={0} className="dropdown-content z-40 mt-1 w-44 p-1 adm-card shadow-lg">
              <li>
                <Link href="/account" prefetch={false} className="flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] hover:bg-base-200">
                  <KeyRound size={15} /> 비밀번호 변경
                </Link>
              </li>
              <li>
                <button type="button" onClick={logout} className="w-full flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] text-error hover:bg-error/10">
                  <LogOut size={15} /> 로그아웃
                </button>
              </li>
            </ul>
          </div>
        </header>
        <main className="flex-1 min-w-0 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
