'use client';

import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';

/**
 * 공통 화면 부품 — 페이지 제목, KPI 카드, 패널, 상태 배지, 빈 행, 입력 필드.
 * 구성은 games_card 통합어드민의 adm.tsx 를 참고했다.
 */

export function PageTitle({ title, desc, right }: { title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-[21px] font-extrabold tracking-tight">{title}</h1>
        {desc && <p className="mt-0.5 text-[12.5px] text-base-content/65">{desc}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export type Tone = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary' | 'neutral';

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  error: 'bg-error/10 text-error',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/10 text-info',
  secondary: 'bg-secondary/10 text-secondary',
  neutral: 'bg-base-content/10 text-base-content/70',
};

/** 요약 카드. href 를 주면 해당 목록으로 이동하고, onClick 을 주면 누를 수 있는 카드가 된다(active 로 선택 표시). */
export function Kpi({
  icon: Icon, label, value, sub, tone = 'primary', href, onClick, active,
}: { icon: ElementType; label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; href?: string; onClick?: () => void; active?: boolean }) {
  const inner = (
    <div className={`adm-card p-4 h-full min-w-0 ${active ? 'ring-2 ring-primary/60' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TONE_BG[tone]}`}>
          <Icon size={18} />
        </span>
        <span className="text-[12.5px] font-semibold text-base-content/75 truncate">{label}</span>
      </div>
      <div className="mt-3 text-[24px] font-extrabold tracking-tight tabular-nums leading-none truncate">{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-base-content/60 truncate">{sub}</div>}
    </div>
  );
  if (onClick) {
    // button 안에는 div 를 둘 수 없어 role=button 으로 처리한다(Enter·Space 로도 동작).
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={!!active}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className="block cursor-pointer rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {inner}
      </div>
    );
  }
  return href ? (
    <Link href={href} prefetch={false} className="block transition-transform hover:-translate-y-0.5">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Panel({
  title, right, children, className = '', bodyClass = '',
}: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`adm-card flex flex-col min-w-0 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-base-300">
          <h2 className="flex items-center gap-2 text-[14px] font-bold min-w-0">
            <span className="w-[3px] h-4 rounded bg-primary shrink-0" />
            <span className="truncate">{title}</span>
          </h2>
          {right && <div className="flex items-center gap-2 text-[12px] shrink-0">{right}</div>}
        </div>
      )}
      <div className={`min-w-0 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export type PillTone = 'blue' | 'green' | 'red' | 'amber' | 'gray' | 'purple';

const PILL: Record<PillTone, string> = {
  blue: 'bg-info/10 text-info',
  green: 'bg-success/10 text-success',
  red: 'bg-error/10 text-error',
  amber: 'bg-warning/15 text-warning',
  gray: 'bg-base-content/10 text-base-content/70',
  purple: 'bg-secondary/10 text-secondary',
};

export function Pill({ tone = 'gray', children, dot, title }: { tone?: PillTone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-semibold whitespace-nowrap ${PILL[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** { text, tone } 라벨 표에서 상태 배지를 만든다. 모르는 값은 회색으로 그대로 표시. */
export function StatusPill({ map, value }: { map: Record<string, { text: string; tone: PillTone }>; value: string }) {
  const l = map[value];
  return <Pill tone={l?.tone || 'gray'} dot>{l?.text || value || '—'}</Pill>;
}

export function EmptyRow({ colSpan, text = '데이터가 없습니다' }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="!text-center !py-10 text-base-content/55">
        {text}
      </td>
    </tr>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-base-content/55">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="mb-3 px-3 py-2 rounded-lg bg-error/10 text-error text-[13px] font-medium">{message}</div>;
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`loading loading-spinner loading-sm text-primary ${className}`} />;
}
