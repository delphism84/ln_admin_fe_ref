/** 기기·SN·QR 화면이 쓰는 API 응답 형태. 계약: empecs_cgms_be/docs/admin_api.md "기기 · SN · QR" */

export type DeviceStatus = 'stock' | 'shipped' | 'active' | 'expired' | 'blocked';
export type DeviceStage = 'stock' | 'shipped';
export type DeviceSource = 'admin' | 'import' | 'app';

export type DeviceOwner = { id: string; email: string; label: string };

/** 목록 item / 상세 공통 */
export type DeviceUnit = {
  id: string;
  serial: string;
  bleMac: string;
  model: string;
  yearCode: string;
  year: number | null;
  sample: boolean;
  seq: number | null;
  formatOk: boolean;
  lotCode: string;
  manufacturedAt: string | null;
  stage: DeviceStage;
  shippedAt: string | null;
  shippedTo: string;
  blocked: boolean;
  blockedReason: string;
  blockedAt: string | null;
  source: DeviceSource;
  verified: boolean;
  note: string;
  status: DeviceStatus;
  startAt: string | null;
  endAt: string | null;
  remainingMs: number | null;
  registeredAt: string | null;
  owner: DeviceOwner | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceHistoryItem = {
  at: string;
  action: string;
  startAt: string | null;
  prevStartAt: string | null;
  userEmail: string;
  prevUserEmail: string;
  byKind: string;
  byName: string;
  note: string;
};

export type DeviceDetail = DeviceUnit & {
  qrPayload: string | null;
  validityDays: number;
  data: { points: number; firstAt: string | null; lastAt: string | null; lastValue: number | null };
  history: DeviceHistoryItem[];
  serverTime: string;
};

export type DeviceSummary = {
  total: number;
  stock: number;
  shipped: number;
  active: number;
  ending: number;
  expired: number;
  blocked: number;
  unverified: number;
  formatBad: number;
  validityDays: number;
  snPolicy: 'flag' | 'block';
};

export type BulkAction = 'ship' | 'stock' | 'verify' | 'setLot' | 'block' | 'unblock';
export type BulkResult = { ok: boolean; matched: number; modified: number };

export type LotStats = { total: number; registered: number; active: number; blocked: number; shipped: number; noMac: number };
export type Lot = LotStats & { code: string; model: string; manufacturedAt: string | null; note: string; createdAt: string };
export type LotsResponse = { items: Lot[]; unassigned: LotStats };

export type QrItem = { serial: string; bleMac: string; lotCode: string; payload: string | null; hasMac: boolean };
export type QrResponse = { items: QrItem[]; missing: string[]; format: string };

export type CreateResult = { ok: boolean; result: 'created' | 'upgraded'; serial: string };

export type GeneratePreview = { ok: boolean; dryRun: true; first: string; last: string; willCreate: number; alreadyExists: number };
export type GenerateResult = { ok: boolean; first: string; last: string; created: number; alreadyExists: number };

export type ImportRow = { serial: string; bleMac?: string; lotCode?: string; manufacturedAt?: string; note?: string };
export type ImportResultKind = 'created' | 'upgraded' | 'skipped' | 'error';
export type ImportResultRow = {
  index: number;
  serial: string;
  result: ImportResultKind;
  error?: string;
  formatOk?: boolean;
  conflictWith?: string;
};
export type ImportSummary = { total: number; created: number; upgraded: number; skipped: number; error: number; formatWarnings: number };
export type ImportResponse = { ok: boolean; dryRun: boolean; summary: ImportSummary; results: ImportResultRow[] };

/** `/devices/<SN>` — 화면 경로와 API 경로(`/api/admin` 기준)가 같다. */
export const devicePath = (serial: string) => `/devices/${encodeURIComponent(serial)}`;
