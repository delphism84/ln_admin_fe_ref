import type { ImportRow } from './types';

export const IMPORT_MAX_ROWS = 5000;

/** RFC 4180 식 CSV → 셀 배열. 따옴표 안의 쉼표·줄바꿈과 "" 이스케이프를 처리한다. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

type ImportField = keyof ImportRow;

const POSITIONAL: ImportField[] = ['serial', 'bleMac', 'lotCode', 'manufacturedAt', 'note'];

/** 머리글 이름 → 필드. 기기 CSV 내보내기의 열 이름(ble_mac, lot)도 받는다. */
const HEADER_ALIAS: Record<string, ImportField> = {
  serial: 'serial', sn: 'serial', 's/n': 'serial',
  blemac: 'bleMac', ble_mac: 'bleMac', mac: 'bleMac',
  lotcode: 'lotCode', lot_code: 'lotCode', lot: 'lotCode',
  manufacturedat: 'manufacturedAt', manufactured_at: 'manufacturedAt',
  note: 'note', memo: 'note',
};

const SERIAL_HEADERS = ['serial', 'sn', 's/n'];

export type ParsedImport = {
  rows: ImportRow[];
  /** rows[i] 가 원본의 몇 번째 줄인지(1부터). 서버 결과의 index 를 줄 번호로 바꿀 때 쓴다. */
  lineNos: number[];
  hasHeader: boolean;
};

/**
 * 붙여 넣은 CSV → 가져오기 요청 행.
 * 첫 줄 첫 칸이 serial/sn/S/N 이면 머리글로 보고 이름으로 열을 찾고, 아니면 serial,bleMac,lotCode,manufacturedAt,note 순서로 읽는다.
 * 빈 칸은 필드를 아예 넣지 않는다 — 그래야 서버가 기본 로트·제조일을 채운다.
 */
export function parseImportCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  const firstIdx = table.findIndex((r) => r.some((c) => c.trim() !== ''));
  if (firstIdx < 0) return { rows: [], lineNos: [], hasHeader: false };

  const hasHeader = SERIAL_HEADERS.includes(table[firstIdx][0].trim().toLowerCase());
  const fields: (ImportField | undefined)[] = hasHeader
    ? table[firstIdx].map((h) => HEADER_ALIAS[h.trim().toLowerCase()])
    : POSITIONAL;

  const rows: ImportRow[] = [];
  const lineNos: number[] = [];
  for (let i = hasHeader ? firstIdx + 1 : firstIdx; i < table.length; i += 1) {
    const cells = table[i];
    if (!cells.some((c) => c.trim() !== '')) continue;
    const row: ImportRow = { serial: '' };
    cells.forEach((c, col) => {
      const field = fields[col];
      const value = c.trim();
      if (field && value !== '') row[field] = value;
    });
    rows.push(row);
    lineNos.push(i + 1);
  }
  return { rows, lineNos, hasHeader };
}
