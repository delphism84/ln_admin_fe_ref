/** 표시용 포맷·라벨. 서버 시각은 모두 UTC ISO — 화면에는 한국시간으로 보여 준다. */
import type { PillTone } from '@/components/ui/adm';

const KST = 9 * 60 * 60 * 1000;

function kstParts(v: string | number | Date | null | undefined): string | null {
  if (v == null || v === '') return null;
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + KST).toISOString();
}

/** 2026-09-30 14:05 */
export function fmtDateTime(v: string | number | Date | null | undefined, withSeconds = false): string {
  const s = kstParts(v);
  if (!s) return '—';
  return `${s.slice(0, 10)} ${s.slice(11, withSeconds ? 19 : 16)}`;
}

export function fmtDate(v: string | number | Date | null | undefined): string {
  const s = kstParts(v);
  return s ? s.slice(0, 10) : '—';
}

/** 한국시간 오늘(YYYY-MM-DD) 기준 n일 전. 날짜 필터 기본값용. */
export function kstDay(offsetDays = 0): string {
  return new Date(Date.now() + KST + offsetDays * 86400000).toISOString().slice(0, 10);
}

/** datetime-local 입력값(한국시간) ↔ ISO */
export function toLocalInput(v: string | Date | null | undefined): string {
  const s = kstParts(v);
  return s ? s.slice(0, 16) : '';
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const t = Date.parse(`${v}:00.000Z`);
  return Number.isNaN(t) ? null : new Date(t - KST).toISOString();
}

export function fmtNumber(n: number | null | undefined): string {
  return n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('ko-KR');
}

/** 남은 시간: "3일 4시간" / "5시간 12분" / "만료 2일 경과" */
export function fmtRemaining(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const text = d > 0 ? `${d}일 ${h}시간` : h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  return ms < 0 ? `만료 ${text} 경과` : text;
}

/** "3시간 전" 같은 상대 시각 */
export function fmtAgo(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '—';
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${Math.floor(diff / 86400000)}일 전`;
}

export function fmtMac(mac: string | null | undefined): string {
  const m = String(mac || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (!m) return '—';
  return m.match(/.{1,2}/g)!.join(':');
}

type Label = { text: string; tone: PillTone };

export const DEVICE_STATUS: Record<string, Label> = {
  stock: { text: '재고', tone: 'gray' },
  shipped: { text: '출고', tone: 'blue' },
  active: { text: '사용 중', tone: 'green' },
  expired: { text: '만료', tone: 'amber' },
  blocked: { text: '차단', tone: 'red' },
};

export const USER_STATUS: Record<string, Label> = {
  active: { text: '정상', tone: 'green' },
  suspended: { text: '정지', tone: 'red' },
  deleted: { text: '탈퇴', tone: 'gray' },
};

export const PROVIDER_LABEL: Record<string, string> = { local: '이메일', google: 'Google', kakao: 'Kakao', apple: 'Apple' };

export const ROLE_LABEL: Record<string, string> = { superadmin: '최고관리자', operator: '운영자', cs: 'CS', viewer: '조회전용' };

export const SOURCE_LABEL: Record<string, string> = { admin: '직접 등록', import: '가져오기', app: '앱 등록' };

export const HISTORY_LABEL: Record<string, string> = {
  register: '앱 등록',
  reregister: '재등록',
  release: '소유권 해제',
  transfer: '소유권 이전',
  start_fix: '시작시각 정정',
  block: '차단',
  unblock: '차단 해제',
  rejected: '등록 거절',
};

export const SYNC_HINT: Record<string, { text: string; desc: string; tone: PillTone }> = {
  app_silent: { text: '앱 무응답', desc: '앱이 서버와 통신하지 않습니다. 앱 종료 또는 로그인 만료 가능성', tone: 'red' },
  never_uploaded: { text: '업로드 없음', desc: '센서 등록 후 혈당이 한 번도 올라오지 않았습니다', tone: 'amber' },
  upload_stalled: { text: '업로드 중단', desc: '앱은 통신 중인데 혈당만 올라오지 않습니다. 센서 연결 문제 가능성', tone: 'amber' },
};

export const ALARM_LABEL: Record<string, string> = { very_low: '매우 낮음', low: '낮음', high: '높음', rate: '급변', system: '신호 끊김' };

export const EVENT_LABEL: Record<string, string> = {
  bloodGlucose: '혈당', exercise: '운동', insulin: '인슐린', memo: '메모', meal: '식사', medication: '약',
};
