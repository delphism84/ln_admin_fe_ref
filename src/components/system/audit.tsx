'use client';

import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { Pill } from '@/components/ui/adm';
import { ROLE_LABEL, fmtDateTime } from '@/lib/format';

/** GET /audit-logs 의 항목 */
export type AuditLog = {
  id: string;
  at: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
  ip?: string;
  userAgent?: string;
  success?: boolean;
};

const ACTION_LABEL: Record<string, string> = {
  'user.update': '회원 정보 수정',
  'user.password_reset': '비밀번호 재설정',
  'user.force_logout': '강제 로그아웃',
  'user.suspend': '회원 정지',
  'user.unsuspend': '정지 해제',
  'user.delete_soft': '탈퇴 처리',
  'user.delete_purge': '회원 완전 삭제',
  'user.restore': '탈퇴 복구',
  'users.export': '회원 내보내기',
  'device.create': '기기 등록',
  'device.update': '기기 수정',
  'device.block': '기기 차단',
  'device.unblock': '차단 해제',
  'device.release': '소유권 해제',
  'device.transfer': '소유권 이전',
  'device.start_fix': '시작시각 정정',
  'device.delete': '기기 삭제',
  'devices.import': '기기 가져오기',
  'devices.generate': 'SN 범위 생성',
  'devices.export': '기기 내보내기',
  'lot.create': '로트 등록',
  'lot.update': '로트 수정',
  'lot.delete': '로트 삭제',
  'admin.create': '관리자 추가',
  'admin.update': '관리자 수정',
  'admin.delete': '관리자 삭제',
  'admin.password_change': '관리자 비밀번호 변경',
  'notice.create': '공지 작성',
  'notice.update': '공지 수정',
  'notice.delete': '공지 삭제',
  'settings.update': '설정 변경',
  'data.export': '데이터 내보내기',
  'data.delete': '데이터 삭제',
  'system.reset': '전체 초기화',
};

/** 알려진 작업 코드의 한글 이름. 모르는 코드는 빈 문자열(코드만 보여 준다). */
export function actionLabel(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  if (action.startsWith('devices.bulk_')) return '기기 일괄 처리';
  return '';
}

export const TARGET_TYPES = ['user', 'device', 'lot', 'admin', 'notice', 'settings', 'glucose', 'system'] as const;

export const TARGET_TYPE_LABEL: Record<string, string> = {
  user: '회원',
  device: '기기',
  lot: '로트',
  admin: '관리자',
  notice: '공지',
  settings: '설정',
  glucose: '혈당 데이터',
  system: '시스템',
};

/** 대상의 상세 화면 주소(회원·기기만). 없으면 null. */
function targetHref(log: AuditLog): string | null {
  if (!log.targetId) return null;
  if (log.targetType === 'user' && /^[0-9a-f]{24}$/i.test(log.targetId)) return `/users/${log.targetId}`;
  if (log.targetType === 'device') return `/devices/${encodeURIComponent(log.targetId)}`;
  return null;
}

export function AuditTarget({ log }: { log: AuditLog }) {
  const text = log.targetLabel || log.targetId || '';
  const href = targetHref(log);
  if (!log.targetType && !text) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {log.targetType && <Pill>{TARGET_TYPE_LABEL[log.targetType] || log.targetType}</Pill>}
      {href ? (
        <Link href={href} prefetch={false} className="text-primary hover:underline truncate max-w-[260px]" onClick={(e) => e.stopPropagation()} title={text}>
          {text}
        </Link>
      ) : (
        <span className="truncate max-w-[260px]" title={text}>{text}</span>
      )}
    </span>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function showValue(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v === '' ? '(빈 값)' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 2);
}

/** before/after 가 객체면 키별로, 아니면 값 전체를 한 줄로 비교한다. */
function changeRows(before: unknown, after: unknown): { key: string; before: unknown; after: unknown }[] {
  if (before == null && after == null) return [];
  const b = isRecord(before) ? before : null;
  const a = isRecord(after) ? after : null;
  if ((before != null && !b) || (after != null && !a)) return [{ key: '값', before: before ?? undefined, after: after ?? undefined }];
  const keys = [...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])];
  return keys.map((key) => ({ key, before: b?.[key], after: a?.[key] }));
}

export function AuditDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const rows = changeRows(log.before, log.after);
  const label = actionLabel(log.action);
  return (
    <Modal
      open
      title="감사 로그 상세"
      onClose={onClose}
      width={760}
      footer={
        <button type="button" className="adm-btn" onClick={onClose}>
          닫기
        </button>
      }
    >
      <dl className="adm-dl">
        <dt>일시</dt>
        <dd>{fmtDateTime(log.at, true)}</dd>
        <dt>작업자</dt>
        <dd>
          {log.actorName || '—'}
          {log.actorRole && <span className="ml-2 text-base-content/55">{ROLE_LABEL[log.actorRole] || log.actorRole}</span>}
        </dd>
        <dt>작업</dt>
        <dd>
          {label && <span className="font-semibold mr-2">{label}</span>}
          <span className="mono text-[12px] text-base-content/60">{log.action}</span>
        </dd>
        <dt>결과</dt>
        <dd>{log.success === false ? <Pill tone="red">실패</Pill> : <Pill tone="green">성공</Pill>}</dd>
        <dt>대상</dt>
        <dd>
          <AuditTarget log={log} />
          {log.targetId && log.targetLabel && <div className="mono text-[11.5px] text-base-content/55 break-all">{log.targetId}</div>}
        </dd>
        <dt>IP</dt>
        <dd className="mono">{log.ip || '—'}</dd>
        {log.userAgent && (
          <>
            <dt>브라우저</dt>
            <dd className="text-[12px] text-base-content/70 break-all">{log.userAgent}</dd>
          </>
        )}
        {log.note && (
          <>
            <dt>메모</dt>
            <dd className="whitespace-pre-wrap break-all">{log.note}</dd>
          </>
        )}
      </dl>

      <h4 className="mt-5 mb-2 text-[13px] font-bold">변경 내용</h4>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-base-content/55">기록된 변경 전/후 값이 없습니다.</p>
      ) : (
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <table className="w-full table-fixed text-[12.5px]">
            <thead className="bg-base-200 text-base-content/70">
              <tr>
                <th scope="col" className="w-[26%] px-3 py-2 text-left font-semibold">항목</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">변경 전</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">변경 후</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-base-300/70 align-top">
                  <td className="px-3 py-2 mono break-all">{r.key}</td>
                  <td className="px-3 py-2 mono whitespace-pre-wrap break-all text-base-content/70">{showValue(r.before)}</td>
                  <td className="px-3 py-2 mono whitespace-pre-wrap break-all">{showValue(r.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
