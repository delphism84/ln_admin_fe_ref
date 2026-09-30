/** 회원 API 응답 형태. 계약: empecs_cgms_be/docs/admin_api.md "회원" */

export type UserStatus = 'active' | 'suspended' | 'deleted';

/** GET /users 목록 행 */
export type UserListItem = {
  id: string;
  email: string;
  name: string;
  provider: string;
  countryCode: string;
  status: string;
  deviceCount: number;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  lastUploadAt: string | null;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  /** 이름(given name) */
  firstName: string;
  /** 성(family name) */
  lastName: string;
  name: string;
  label: string;
  dateOfBirth: string;
  gender: string;
  unit: string;
  countryCode: string;
  language: string;
  provider: string;
  providerId: string;
  hasPassword: boolean;
  status: string;
  suspendedReason: string;
  suspendedAt: string | null;
  deletedAt: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  lastUploadAt: string | null;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

export type UserDevice = {
  id: string;
  serial: string;
  bleMac: string;
  startAt: string | null;
  endAt: string | null;
  remainingMs: number | null;
  status: string;
  verified: boolean;
  lotCode: string;
};

export type UserAlarm = {
  type: string;
  enabled: boolean;
  threshold: number | null;
  repeatMin: number | null;
  sound: boolean;
  vibrate: boolean;
  quietFrom: string;
  quietTo: string;
};

export type UserAppSetting = {
  unit: string;
  notifications: boolean;
  darkMode: boolean;
  updatedAt: string;
};

export type UserDataSummary = {
  totalPoints: number;
  eventCount: number;
  firstAt: string | null;
  lastAt: string | null;
  lastValue: number | null;
  lastEqsn: string;
};

export type GlucoseThresholds = { veryLow: number; low: number; high: number };

export type UserStats14d = {
  points: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  lowPct: number | null;
  inRangePct: number | null;
  highPct: number | null;
  thresholds: GlucoseThresholds;
};

export type UserLogin = {
  at: string;
  success: boolean;
  reason: string;
  method: string;
  ip: string;
};

/** GET /users/:id/overview */
export type UserOverview = {
  user: AdminUser;
  devices: UserDevice[];
  alarms: UserAlarm[];
  appSetting: UserAppSetting | null;
  data: UserDataSummary;
  stats14d: UserStats14d;
  logins: UserLogin[];
  serverTime: string;
};

export type GlucosePoint = { t: number; v: number; lo?: number; hi?: number };

/** GET /users/:id/glucose */
export type GlucoseResponse = {
  points: GlucosePoint[];
  total: number;
  downsampled: boolean;
  from: string;
  to: string;
};

/** GET /users/:id/events 행 */
export type UserEvent = {
  id: string;
  type: string;
  time: string;
  memo: string;
  eqsn: string;
};

/** PATCH /users/:id 본문 */
export type UserPatch = Partial<
  Pick<AdminUser, 'email' | 'firstName' | 'lastName' | 'name' | 'dateOfBirth' | 'gender' | 'unit' | 'countryCode' | 'language' | 'adminNote'>
>;

export type PurgeResult = {
  ok: boolean;
  mode: 'purge';
  deleted: { glucose: number; events: number; alarms: number; sensors: number; settings: number; devicesReleased: number };
};
