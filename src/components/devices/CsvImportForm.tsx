'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Copy, Upload } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { fmtNumber } from '@/lib/format';
import { Field, Pill, type PillTone } from '@/components/ui/adm';
import LotInput from './LotInput';
import { IMPORT_MAX_ROWS, parseImportCsv, type ParsedImport } from './csv';
import type { ImportResponse, ImportResultKind, ImportResultRow } from './types';

const SAMPLE_CSV = `serial,bleMac,lotCode,manufacturedAt,note
C21Z00101,04AC44111101,LOT-2609A,2026-09-01,
C21Z00102,04:AC:44:11:11:02,LOT-2609A,2026-09-01,"재작업, 2차 검수"
C21Z00103,,,,MAC 은 나중에 입력`;

const RESULT_LABEL: Record<ImportResultKind, { text: string; tone: PillTone }> = {
  created: { text: '생성', tone: 'green' },
  upgraded: { text: '확인 승격', tone: 'blue' },
  skipped: { text: '건너뜀', tone: 'gray' },
  error: { text: '오류', tone: 'red' },
};

const ROW_ERROR: Record<string, string> = {
  serial_required: 'SN 이 비어 있습니다',
  duplicate_in_file: '파일 안에 같은 SN 이 또 있습니다',
  duplicate_mac_in_file: '파일 안에 같은 MAC 이 또 있습니다',
  invalid_bleMac: 'MAC 형식이 올바르지 않습니다',
  bleMac_conflict: '다른 SN 이 이미 같은 MAC 을 사용 중입니다',
  invalid_manufacturedAt: '제조일 형식이 올바르지 않습니다',
  serial_too_long: 'SN 이 너무 깁니다(40자 초과)',
  save_failed: '저장하지 못했습니다',
};

const SHOW_MAX = 500;

function rowNote(r: ImportResultRow): string {
  if (r.result === 'error') {
    const text = ROW_ERROR[r.error || ''] || r.error || '알 수 없는 오류';
    return r.conflictWith ? `${text} (${r.conflictWith})` : text;
  }
  const notes: string[] = [];
  if (r.result === 'skipped') notes.push('이미 확인된 SN');
  if (r.result === 'upgraded') notes.push('앱이 먼저 등록한 미확인 SN');
  if (r.formatOk === false) notes.push('SN 형식이 규칙과 다름');
  return notes.join(' · ');
}

type Outcome = { response: ImportResponse; lineNos: number[] };

function OutcomeView({ outcome }: { outcome: Outcome }) {
  const { summary, results, dryRun } = outcome.response;
  const ordered = useMemo(
    () => [...results].sort((a, b) => Number(b.result === 'error') - Number(a.result === 'error') || a.index - b.index),
    [results],
  );
  const counts: { label: string; value: number; cls: string }[] = [
    { label: dryRun ? '생성 예정' : '생성', value: summary.created, cls: 'text-success' },
    { label: dryRun ? '확인 승격 예정' : '확인 승격', value: summary.upgraded, cls: 'text-info' },
    { label: '건너뜀', value: summary.skipped, cls: 'text-base-content/70' },
    { label: '오류', value: summary.error, cls: summary.error > 0 ? 'text-error' : 'text-base-content/70' },
    { label: '형식 경고', value: summary.formatWarnings, cls: summary.formatWarnings > 0 ? 'text-warning' : 'text-base-content/70' },
  ];
  return (
    <div className="adm-card" aria-live="polite">
      <div className="px-4 py-3 border-b border-base-300">
        <h2 className="text-[14px] font-bold">
          {dryRun ? '미리보기' : '가져오기 결과'} <span className="font-normal text-base-content/60">— 전체 {fmtNumber(summary.total)}행</span>
        </h2>
        <dl className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {counts.map((c) => (
            <div key={c.label} className="rounded-lg bg-base-200 px-3 py-2">
              <dt className="text-[11.5px] text-base-content/65">{c.label}</dt>
              <dd className={`text-[18px] font-extrabold tabular-nums ${c.cls}`}>{fmtNumber(c.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="adm-table-wrap max-h-[480px] overflow-y-auto">
        <table className="adm-table">
          <thead>
            <tr>
              <th className="num">행 번호</th>
              <th>S/N</th>
              <th>결과</th>
              <th>사유</th>
            </tr>
          </thead>
          <tbody>
            {ordered.slice(0, SHOW_MAX).map((r) => (
              <tr key={r.index}>
                <td className="num">{outcome.lineNos[r.index] ?? r.index + 1}</td>
                <td className="mono">{r.serial || '—'}</td>
                <td>
                  <Pill tone={RESULT_LABEL[r.result]?.tone || 'gray'}>{RESULT_LABEL[r.result]?.text || r.result}</Pill>
                </td>
                <td className={r.result === 'error' ? 'text-error' : 'text-base-content/70'}>{rowNote(r) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordered.length > SHOW_MAX && (
        <p className="px-4 py-2 text-[12px] text-base-content/60">
          오류를 먼저, {fmtNumber(SHOW_MAX)}행까지만 표시합니다 (전체 {fmtNumber(ordered.length)}행).
        </p>
      )}
    </div>
  );
}

/** CSV 가져오기: 붙여 넣기 또는 파일 → 미리보기(dryRun) → 실행. */
export default function CsvImportForm({ lots }: { lots: string[] }) {
  const [text, setText] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [preview, setPreview] = useState<(Outcome & { parsed: ParsedImport }) | null>(null);
  const [final, setFinal] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseImportCsv(text), [text]);
  const tooMany = parsed.rows.length > IMPORT_MAX_ROWS;

  // 입력이 바뀌면 이전 미리보기·결과는 버린다(미리 본 내용과 다른 것을 실행하지 않도록).
  const invalidate = () => {
    setPreview(null);
    setFinal(null);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? '').replace(/^﻿/, ''));
      invalidate();
    };
    reader.onerror = () => toast.error('파일을 읽지 못했습니다.');
    reader.readAsText(file);
    e.target.value = '';
  };

  const send = (p: ParsedImport, dryRun: boolean) =>
    api<ImportResponse>('/devices/import', {
      body: { rows: p.rows, lotCode: lotCode.trim() || undefined, manufacturedAt: manufacturedAt || undefined, dryRun },
    });

  const onPreview = async () => {
    setBusy(true);
    setFinal(null);
    try {
      const response = await send(parsed, true);
      setPreview({ response, lineNos: parsed.lineNos, parsed });
    } catch (e) {
      setPreview(null);
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onRun = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const response = await send(preview.parsed, false);
      setFinal({ response, lineNos: preview.lineNos });
      setPreview(null);
      const s = response.summary;
      toast.success(`가져오기 완료: 생성 ${fmtNumber(s.created)}건, 확인 승격 ${fmtNumber(s.upgraded)}건`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onCopySample = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_CSV);
      toast.success('예시 CSV 를 복사했습니다');
    } catch {
      toast.error('복사하지 못했습니다. 직접 선택해 복사해 주세요.');
    }
  };

  const toApply = preview ? preview.response.summary.created + preview.response.summary.upgraded : 0;
  const shown = preview ?? final;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="adm-card p-4 lg:col-span-2 grid gap-3 content-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="csv-text" className="adm-label !mb-0">
              CSV 내용
            </label>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> CSV 파일 선택
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} aria-label="CSV 파일 선택" />
          </div>
          <textarea
            id="csv-text"
            className="adm-input mono"
            rows={12}
            spellCheck={false}
            value={text}
            placeholder={'serial,bleMac,lotCode,manufacturedAt,note\nC21Z00101,04AC44111101,LOT-2609A,2026-09-01,'}
            onChange={(e) => {
              setText(e.target.value);
              invalidate();
            }}
          />
          <p className={`text-[12px] ${tooMany ? 'text-error font-medium' : 'text-base-content/60'}`}>
            {tooMany
              ? `한 번에 ${fmtNumber(IMPORT_MAX_ROWS)}행까지 가져올 수 있습니다. 지금 ${fmtNumber(parsed.rows.length)}행입니다 — 파일을 나눠 주세요.`
              : `${fmtNumber(parsed.rows.length)}행 인식 · ${parsed.hasHeader ? '첫 줄을 머리글로 읽었습니다(열 이름으로 매핑)' : '머리글 없음(열 순서: serial, bleMac, lotCode, manufacturedAt, note)'}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="기본 로트 (선택)" hint="로트 칸이 빈 행에 적용됩니다.">
              <LotInput
                lots={lots}
                value={lotCode}
                onChange={(v) => {
                  setLotCode(v);
                  invalidate();
                }}
              />
            </Field>
            <Field label="기본 제조일 (선택)" hint="제조일 칸이 빈 행에 적용됩니다.">
              <input
                type="date"
                className="adm-input"
                value={manufacturedAt}
                onChange={(e) => {
                  setManufacturedAt(e.target.value);
                  invalidate();
                }}
              />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="adm-btn" disabled={busy || parsed.rows.length === 0 || tooMany} onClick={onPreview}>
              미리보기
            </button>
            <button type="button" className="adm-btn adm-btn-primary" disabled={busy || !preview || toApply === 0} onClick={onRun}>
              가져오기 실행{preview ? ` (${fmtNumber(toApply)}건)` : ''}
            </button>
          </div>
          {preview && toApply === 0 && <p className="text-[12px] text-base-content/60 text-right">생성하거나 확인 승격할 행이 없습니다.</p>}
          {preview && toApply > 0 && preview.response.summary.error > 0 && (
            <p className="text-[12px] text-warning text-right">오류 {fmtNumber(preview.response.summary.error)}행은 제외하고 나머지만 가져옵니다.</p>
          )}
        </div>

        <div className="adm-card p-4 content-start">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-[13px] font-bold">예시 CSV</h2>
            <button type="button" className="adm-btn adm-btn-sm" onClick={onCopySample}>
              <Copy size={13} /> 복사
            </button>
          </div>
          <pre className="mono overflow-x-auto rounded-lg bg-base-200 p-3 leading-relaxed">{SAMPLE_CSV}</pre>
          <ul className="mt-3 grid gap-1 text-[12px] text-base-content/65 list-disc pl-4">
            <li>머리글 줄은 없어도 됩니다. 있으면 열 이름(serial, bleMac, lotCode, manufacturedAt, note)으로 읽습니다.</li>
            <li>serial 만 필수입니다. 쉼표가 들어가는 값은 큰따옴표로 감싸 주세요.</li>
            <li>이미 확인된 SN 은 건너뜁니다. 앱이 먼저 등록한 미확인 SN 은 확인 처리하고 로트·MAC 을 채웁니다.</li>
            <li>MAC 이 없는 SN 의 QR 은 SN 만 담겨 앱에서 BLE 자동 연결이 되지 않습니다.</li>
          </ul>
        </div>
      </div>

      {shown && <OutcomeView outcome={shown} />}
      {final && (
        <div>
          <Link href="/devices?status=stock" prefetch={false} className="adm-btn adm-btn-sm">
            기기 목록에서 보기
          </Link>
        </div>
      )}
    </div>
  );
}
