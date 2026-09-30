/** 시스템 설정의 타입과 폼 ↔ 서버 값 변환·검증. 규칙은 BE lib/settingsStore.js 의 sanitizeSettings 와 맞춘다. */

export type SnPolicy = 'flag' | 'block';

export type SystemSettings = {
  eqValidityDays: number;
  endingSoonHours: number;
  snPolicy: SnPolicy;
  snPattern: string;
  yearCodes: Record<string, number>;
  qrAdvName: string;
  qrManufacturerId: string;
  syncGapHours: number;
  adminSessionHours: number;
  adminIpEnforce: boolean;
  adminIpAllowlist: string[];
};

export type SettingsResponse = { settings: SystemSettings; defaults: SystemSettings };

export type YearCodeRow = { code: string; year: string };

/** 입력 중인 값. 숫자도 문자열로 들고 있다가 저장할 때 검증한다. */
export type SettingsForm = {
  eqValidityDays: string;
  endingSoonHours: string;
  snPolicy: SnPolicy;
  snPattern: string;
  yearCodes: YearCodeRow[];
  qrAdvName: string;
  qrManufacturerId: string;
  syncGapHours: string;
  adminSessionHours: string;
  adminIpEnforce: boolean;
  adminIpAllowlist: string;
};

export type SettingsErrors = Partial<Record<keyof SettingsForm, string>>;

/** 서버가 허용하는 범위(벗어나면 서버가 조용히 잘라 내므로 FE 에서 먼저 막는다). */
export const INT_RANGE = {
  eqValidityDays: [1, 90],
  endingSoonHours: [1, 240],
  syncGapHours: [1, 720],
  adminSessionHours: [1, 72],
} as const satisfies Partial<Record<keyof SystemSettings, readonly [number, number]>>;

type IntKey = keyof typeof INT_RANGE;
const INT_KEYS = Object.keys(INT_RANGE) as IntKey[];

const YEAR_MIN = 2000;
const YEAR_MAX = 2100;
const ALLOWLIST_MAX = 200;

export function toForm(s: SystemSettings): SettingsForm {
  return {
    eqValidityDays: String(s.eqValidityDays),
    endingSoonHours: String(s.endingSoonHours),
    snPolicy: s.snPolicy,
    snPattern: s.snPattern,
    yearCodes: Object.entries(s.yearCodes || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, year]) => ({ code, year: String(year) })),
    qrAdvName: s.qrAdvName,
    qrManufacturerId: s.qrManufacturerId,
    syncGapHours: String(s.syncGapHours),
    adminSessionHours: String(s.adminSessionHours),
    adminIpEnforce: s.adminIpEnforce,
    adminIpAllowlist: (s.adminIpAllowlist || []).join('\n'),
  };
}

export function compilePattern(pattern: string): RegExp | null {
  if (!pattern.trim()) return null;
  try {
    return new RegExp(pattern.trim());
  } catch {
    return null;
  }
}

export function parseAllowlist(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
}

/** 서버 ipAllowed 와 같은 판정: 루프백은 항상 허용, '.'·':' 로 끝나면 앞부분 일치, 아니면 완전 일치. */
export function ipAllowed(ip: string, list: string[]): boolean {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return true;
  return list.some((e) => (e.endsWith('.') || e.endsWith(':') ? ip.startsWith(e) : ip === e));
}

function parseIntStrict(v: string): number | null {
  return /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
}

/** 폼 검증. 오류가 없으면 서버에 보낼 수 있는 값(values)을 함께 돌려준다. */
export function validateForm(f: SettingsForm): { errors: SettingsErrors; values: SystemSettings | null } {
  const errors: SettingsErrors = {};
  const ints = {} as Record<IntKey, number>;
  for (const key of INT_KEYS) {
    const [min, max] = INT_RANGE[key];
    const n = parseIntStrict(f[key]);
    if (n === null || n < min || n > max) errors[key] = `${min}~${max} 사이의 정수를 입력해 주세요.`;
    else ints[key] = n;
  }

  if (!f.snPattern.trim()) errors.snPattern = '정규식을 입력해 주세요.';
  else if (!compilePattern(f.snPattern)) errors.snPattern = '정규식 문법이 올바르지 않습니다.';

  const yearCodes: Record<string, number> = {};
  for (const row of f.yearCodes) {
    const code = row.code.trim().toUpperCase();
    const year = parseIntStrict(row.year);
    if (!/^[A-Z]$/.test(code)) errors.yearCodes = '코드는 영문 대문자 한 글자(A–Z)입니다.';
    else if (year === null || year < YEAR_MIN || year > YEAR_MAX) errors.yearCodes = `연도는 ${YEAR_MIN}~${YEAR_MAX} 사이로 입력해 주세요.`;
    else if (code in yearCodes) errors.yearCodes = `코드 ${code} 가 중복되었습니다.`;
    else yearCodes[code] = year;
  }

  const qrAdvName = f.qrAdvName.trim();
  if (!qrAdvName) errors.qrAdvName = '광고 이름을 입력해 주세요.';
  else if (qrAdvName.length > 32) errors.qrAdvName = '32자 이내로 입력해 주세요.';
  else if (qrAdvName.includes(';')) errors.qrAdvName = "';' 는 QR 구분자라 쓸 수 없습니다.";

  const qrManufacturerId = f.qrManufacturerId.trim().replace(/^0x/i, '').toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(qrManufacturerId)) errors.qrManufacturerId = '16진수 4자리로 입력해 주세요 (예: FFFF).';

  const adminIpAllowlist = parseAllowlist(f.adminIpAllowlist);
  if (adminIpAllowlist.length > ALLOWLIST_MAX) errors.adminIpAllowlist = `최대 ${ALLOWLIST_MAX}개까지 등록할 수 있습니다.`;
  else if (adminIpAllowlist.some((e) => /\s/.test(e))) errors.adminIpAllowlist = '한 줄에 IP 하나씩, 공백 없이 입력해 주세요.';
  else if (f.adminIpEnforce && adminIpAllowlist.length === 0) errors.adminIpAllowlist = 'IP 제한을 켜려면 허용할 IP 를 하나 이상 입력해 주세요.';

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      ...ints,
      snPolicy: f.snPolicy,
      snPattern: f.snPattern.trim(),
      yearCodes,
      qrAdvName,
      qrManufacturerId,
      adminIpEnforce: f.adminIpEnforce,
      adminIpAllowlist,
    },
  };
}

/** 키 순서에 상관없이 비교할 수 있는 문자열. */
function stable(v: unknown): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  }
  return JSON.stringify(v);
}

/** 서버 값과 달라진 키만 골라 PUT /settings 본문을 만든다. */
export function buildPatch(values: SystemSettings, server: SystemSettings): Partial<SystemSettings> {
  const patch: Partial<SystemSettings> = {};
  for (const key of Object.keys(values) as (keyof SystemSettings)[]) {
    if (stable(values[key]) !== stable(server[key])) Object.assign(patch, { [key]: values[key] });
  }
  return patch;
}
