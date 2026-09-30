'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { LayoutDashboard, Users, Cpu, Database, Settings, LogOut, ChevronDown } from 'lucide-react'

import { ADMIN_TOKEN_KEY } from '@/lib/adminApi'

type NavLeaf = { href: string; label: string }
type NavGroup = { key: string; label: string; icon: typeof LayoutDashboard; children: NavLeaf[] }
type NavLeafTop = { href: string; label: string; icon: typeof LayoutDashboard }
type NavItem = NavGroup | NavLeafTop

const nav: NavItem[] = [
  {
    key: 'dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
    children: [
      { href: '/dashboard', label: '전체 현황' },
      { href: '/dashboard/world', label: '전세계 현황' }
    ]
  },
  { href: '/users', label: '사용자 관리', icon: Users },
  {
    key: 'devices',
    label: '기기 관리',
    icon: Cpu,
    children: [
      { href: '/devices', label: '전체 기기' },
      { href: '/devices/ending', label: '종료 예정 기기' }
    ]
  },
  { href: '/data', label: '데이터 관리', icon: Database },
  { href: '/settings', label: '설정', icon: Settings }
]

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/devices') return pathname === '/devices'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item && Array.isArray(item.children)
}

export default function CgmsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const defaultOpen = useMemo(() => {
    const o: Record<string, boolean> = {}
    for (const item of nav) {
      if (isGroup(item)) {
        o[item.key] = item.children.some((c) => isActivePath(pathname, c.href))
      }
    }
    return o
  }, [pathname])
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(defaultOpen)

  const logout = () => {
    if (typeof window !== 'undefined') localStorage.removeItem(ADMIN_TOKEN_KEY)
    window.location.href = '/login'
  }

  return (
    <div className='d-flex min-vh-100'>
      <aside className='d-flex flex-column border-end bg-white shadow-sm' style={{ width: 240, minWidth: 240 }}>
        <div className='p-3 border-bottom'>
          <Link href='/dashboard' className='text-decoration-none fw-semibold text-dark'>
            EMPECS CGMS
          </Link>
          <div className='small text-secondary'>Admin</div>
        </div>
        <nav className='nav flex-column p-2 gap-1 flex-grow-1'>
          {nav.map((item) => {
            const Icon = item.icon
            if (isGroup(item)) {
              const groupActive = item.children.some((c) => isActivePath(pathname, c.href))
              const open = openMap[item.key] ?? groupActive
              return (
                <div key={item.key} className='d-flex flex-column gap-1'>
                  <button
                    type='button'
                    className={`nav-link d-flex align-items-center gap-2 rounded py-2 px-3 border-0 text-start w-100 ${
                      groupActive ? 'bg-primary text-white' : 'text-dark bg-transparent'
                    }`}
                    onClick={() => setOpenMap((m) => ({ ...m, [item.key]: !open }))}
                    aria-expanded={open}
                  >
                    <Icon size={18} />
                    <span className='flex-grow-1'>{item.label}</span>
                    <ChevronDown size={16} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  </button>
                  {open ? (
                    <div className='d-flex flex-column gap-1 ps-2'>
                      {item.children.map((child) => {
                        const active = isActivePath(pathname, child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`nav-link rounded py-1 px-3 ms-3 small ${
                              active ? 'bg-primary-subtle text-primary fw-semibold' : 'text-secondary'
                            }`}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            }

            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link d-flex align-items-center gap-2 rounded py-2 px-3 ${
                  active ? 'bg-primary text-white' : 'text-dark'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className='p-2 mt-auto border-top'>
          <button type='button' className='btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2' onClick={logout}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>
      <main className='flex-grow-1 overflow-auto' style={{ background: 'var(--bs-body-bg)' }}>
        <div className='container-fluid py-4 px-4'>{children}</div>
      </main>
    </div>
  )
}
