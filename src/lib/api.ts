/**
 * 관리자 API 클라이언트. 계약: empecs_cgms_be/docs/admin_api.md
 *
 * 예전 화면은 401 을 받아도 "인증 만료" 글자만 보여 주고 머물렀다.
 * 여기서 한 번에 처리한다: 401 → 토큰 삭제 후 로그인 화면, 비밀번호 변경 강제 → 계정 화면.
 */
export const TOKEN_KEY = 'empecs_admin_jwt';

export type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  status: number;
  code: string;
  data: any;
  constructor(status: number, code: string, data: any) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/api/admin${path.startsWith('/') ? path : `/${path}`}`;
}

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

function handleAuthFailure(status: number, code: string, path: string) {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname;
  if (status === 401 && path !== '/login') {
    setToken(null);
    if (!here.startsWith('/login')) window.location.replace('/login?expired=1');
  } else if (status === 403 && code === 'password_change_required' && !here.startsWith('/account')) {
    window.location.replace('/account?force=1');
  }
}

export type ApiOptions = { method?: string; query?: Query; body?: unknown; signal?: AbortSignal };

async function request(path: string, opts: ApiOptions = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(apiUrl(path) + buildQuery(opts.query), {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: 'no-store',
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'network_error', null);
  }
  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* 본문 없음 */
    }
    const code = String(data?.error || `http_${res.status}`);
    handleAuthFailure(res.status, code, path);
    throw new ApiError(res.status, code, data);
  }
  return res;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** CSV 등 파일 받기(토큰 헤더가 필요해 링크로는 받을 수 없다). */
export async function download(path: string, query: Query | undefined, fallbackName: string) {
  const res = await request(path, { query });
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const MESSAGES: Record<string, string> = {
  network_error: '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.',
  invalid_credentials: '아이디 또는 비밀번호가 올바르지 않습니다.',
  too_many_attempts: '로그인 시도가 너무 많습니다. 10분 뒤 다시 시도해 주세요.',
  ip_not_allowed: '허용되지 않은 IP 입니다.',
  invalid_token: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  forbidden: '이 작업을 할 권한이 없습니다.',
  password_change_required: '먼저 비밀번호를 변경해 주세요.',
  invalid_password: '현재 비밀번호가 올바르지 않습니다.',
  password_min_10: '비밀번호는 10자 이상이어야 합니다.',
  password_min_8: '비밀번호는 8자 이상이어야 합니다.',
  password_needs_letter_and_digit: '비밀번호에 영문과 숫자를 모두 넣어 주세요.',
  password_same_as_old: '이전과 다른 비밀번호를 입력해 주세요.',
  invalid_username: '아이디는 영문 소문자·숫자 3~32자로 입력해 주세요.',
  username_taken: '이미 사용 중인 아이디입니다.',
  last_superadmin: '마지막 최고관리자는 변경하거나 삭제할 수 없습니다.',
  cannot_delete_self: '본인 계정은 삭제할 수 없습니다.',
  not_found: '대상을 찾을 수 없습니다.',
  invalid_id: '잘못된 요청입니다.',
  email_taken: '이미 사용 중인 이메일입니다.',
  email_required: '이메일을 입력해 주세요.',
  confirm_mismatch: '확인용 이메일이 일치하지 않습니다.',
  confirm_required: '확인 문구를 정확히 입력해 주세요.',
  user_deleted: '탈퇴 처리된 회원입니다.',
  not_suspended: '정지 상태가 아닙니다.',
  not_deleted: '탈퇴 상태가 아닙니다.',
  user_not_found: '해당 회원을 찾을 수 없습니다.',
  serial_required: 'SN 을 입력해 주세요.',
  serial_exists: '이미 등록된 SN 입니다.',
  serial_format: 'SN 형식이 규칙과 다릅니다.',
  serial_too_long: 'SN 이 너무 깁니다.',
  invalid_bleMac: 'MAC 주소 형식이 올바르지 않습니다.',
  bleMac_conflict: '다른 SN 이 이미 같은 MAC 을 사용 중입니다.',
  invalid_manufacturedAt: '제조일 형식이 올바르지 않습니다.',
  not_registered: '앱에 등록되지 않은 센서입니다.',
  registered_release_first: '앱에 등록된 센서입니다. 먼저 소유권을 해제해 주세요.',
  invalid_startAt: '시작 시각이 올바르지 않습니다.',
  startAt_in_future: '시작 시각은 미래일 수 없습니다.',
  rows_required: '등록할 행이 없습니다.',
  too_many_rows: '한 번에 5,000행까지 등록할 수 있습니다.',
  invalid_model: '모델 코드는 C + 숫자 2자리입니다(예: C21).',
  invalid_yearCode: '연도 코드는 영문 대문자 1자입니다.',
  invalid_range: '시작 번호와 개수를 확인해 주세요(최대 2,000개).',
  seq_overflow: '일련번호가 99999 를 넘습니다.',
  pattern_mismatch: '현재 SN 규칙 설정과 맞지 않습니다.',
  serials_required: 'SN 을 선택해 주세요.',
  invalid_code: '로트 코드는 영문·숫자·.-_ 1~40자입니다.',
  code_exists: '이미 있는 로트 코드입니다.',
  lot_not_empty: '이 로트에 센서가 남아 있어 삭제할 수 없습니다.',
  filter_required: '내보낼 조건(회원·SN·기간 중 하나)을 지정해 주세요.',
  userId_required: '회원을 지정해 주세요.',
  title_required: '제목을 입력해 주세요.',
  invalid_role: '역할 값이 올바르지 않습니다.',
  invalid_status: '상태 값이 올바르지 않습니다.',
  invalid_publishAt: '게시 시작 시각이 올바르지 않습니다.',
  invalid_expireAt: '게시 종료 시각이 올바르지 않습니다.',
  invalid_stage: '단계 값이 올바르지 않습니다.',
  invalid_action: '지원하지 않는 작업입니다.',
  invalid_dateOfBirth: '생년월일은 YYYY-MM-DD 형식으로 입력해 주세요.',
  invalid_gender: '성별 값이 올바르지 않습니다.',
  invalid_unit: '단위 값이 올바르지 않습니다.',
  internal_error: '서버 오류가 발생했습니다.',
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return MESSAGES[e.code] || `요청에 실패했습니다 (${e.code})`;
  if (e instanceof Error) return e.message;
  return '알 수 없는 오류가 발생했습니다.';
}
