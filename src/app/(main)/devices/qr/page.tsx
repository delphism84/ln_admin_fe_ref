'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Printer } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { fmtMac, fmtNumber } from '@/lib/format';
import { ErrorBox, Field, PageTitle, Spinner } from '@/components/ui/adm';
import { useLots, useQrImages } from '@/components/devices/hooks';
import type { QrItem, QrResponse } from '@/components/devices/types';

/** 서버가 한 번에 돌려주는 최대 개수 */
const MAX_LABELS = 1000;
/** serials 는 쿼리 문자열로 가므로 주소가 너무 길어지지 않게 나눠 보낸다. */
const CHUNK = 150;

const SIZES = [
  { id: 's', label: '소 (25mm)', mm: 25, snPt: 7, subPt: 5.5 },
  { id: 'm', label: '중 (35mm)', mm: 35, snPt: 9, subPt: 6.5 },
  { id: 'l', label: '대 (50mm)', mm: 50, snPt: 12, subPt: 8.5 },
] as const;

type SizeId = (typeof SIZES)[number]['id'];

const LABEL_PAD_MM = 2;
const GAP_MM = 3;
/** A4 세로의 인쇄 가능 폭(여백 10mm 기준) */
const A4_WIDTH_MM = 190;

const PRINT_CSS = `
.qr-label { break-inside: avoid; page-break-inside: avoid; }
@media print {
  @page { margin: 10mm; }
  main { padding: 0 !important; }
  .qr-sheet { border: 0 !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
}
`;

function parseSerials(text: string): string[] {
  return [...new Set(text.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

type Loaded = { items: QrItem[]; missing: string[]; truncated: boolean };

async function fetchLabels(serials: string[], lot: string, signal: AbortSignal): Promise<Loaded> {
  if (serials.length === 0) {
    const r = await api<QrResponse>('/devices/qr', { query: { lot }, signal });
    return { items: r.items, missing: r.missing, truncated: r.items.length >= MAX_LABELS };
  }
  const items = new Map<string, QrItem>();
  const missing: string[] = [];
  for (let i = 0; i < serials.length; i += CHUNK) {
    const r = await api<QrResponse>('/devices/qr', { query: { serials: serials.slice(i, i + CHUNK).join(',') }, signal });
    r.items.forEach((it) => items.set(it.serial, it));
    missing.push(...r.missing);
  }
  return { items: [...items.values()].sort((a, b) => a.serial.localeCompare(b.serial)), missing, truncated: false };
}

function QrLabels() {
  const params = useSearchParams();
  const paramKey = params.toString();
  const { lots } = useLots();

  const [serialsText, setSerialsText] = useState(() => params.get('serials') || '');
  const [lot, setLot] = useState(() => (params.get('lot') || '').toUpperCase());
  const [sizeId, setSizeId] = useState<SizeId>('m');
  const [cols, setCols] = useState(4);
  const [show, setShow] = useState({ sn: true, mac: true, lot: false });

  const [request, setRequest] = useState<{ serials: string[]; lot: string } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const serials = useMemo(() => parseSerials(serialsText), [serialsText]);
  const tooMany = serials.length > MAX_LABELS;

  // 주소에 serials·lot 이 있으면 바로 불러온다(목록·상세·로트 화면에서 넘어오는 경우).
  useEffect(() => {
    const p = new URLSearchParams(paramKey);
    const text = p.get('serials') || '';
    const lotCode = (p.get('lot') || '').toUpperCase();
    setSerialsText(text);
    setLot(lotCode);
    const list = parseSerials(text).slice(0, MAX_LABELS);
    if (list.length > 0 || lotCode) setRequest({ serials: list, lot: lotCode });
  }, [paramKey]);

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    fetchLabels(request.serials, request.lot, ctrl.signal)
      .then(setLoaded)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setLoaded(null);
        setError(errorMessage(e));
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [request]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tooMany) return;
    if (serials.length === 0 && !lot) {
      toast.info('SN 을 입력하거나 로트를 선택해 주세요.');
      return;
    }
    setRequest({ serials, lot });
  };

  const items = useMemo(() => loaded?.items ?? [], [loaded]);
  const payloads = useMemo(() => items.map((it) => it.payload || ''), [items]);
  const images = useQrImages(payloads, 320);
  const printable = items.filter((it) => it.payload);
  const ready = printable.length > 0 && printable.every((it) => images[it.payload as string]);
  const noMac = items.filter((it) => !it.hasMac).length;

  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[1];
  const rowWidthMm = cols * (size.mm + LABEL_PAD_MM * 2) + (cols - 1) * GAP_MM;
  const lotOptions = lot && !lots.some((l) => l.code === lot) ? [lot, ...lots.map((l) => l.code)] : lots.map((l) => l.code);

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <PageTitle
        title="QR 라벨"
        desc="센서에 붙이는 QR 라벨을 인쇄합니다. QR 에는 앱이 읽는 문자열이 서버에서 만든 그대로 들어갑니다."
        right={
          <button type="button" className="adm-btn adm-btn-primary" disabled={!ready} onClick={() => window.print()}>
            <Printer size={15} /> 인쇄
          </button>
        }
      />

      <form className="no-print adm-card p-4 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4" onSubmit={onSubmit}>
        <div className="grid gap-3 content-start">
          <Field
            label="S/N 목록"
            hint={
              tooMany ? (
                <span className="text-error font-medium">한 번에 {fmtNumber(MAX_LABELS)}개까지 만들 수 있습니다. 지금 {fmtNumber(serials.length)}개입니다.</span>
              ) : (
                `쉼표 또는 줄바꿈으로 구분 · ${fmtNumber(serials.length)}개 입력됨. 입력하면 로트 선택보다 우선합니다.`
              )
            }
          >
            <textarea className="adm-input mono" rows={5} spellCheck={false} value={serialsText} onChange={(e) => setSerialsText(e.target.value)} placeholder={'C21Z00101, C21Z00102\nC21Z00103'} />
          </Field>
          <Field label="로트" hint={`로트의 SN 전체를 라벨로 만듭니다(최대 ${fmtNumber(MAX_LABELS)}개).`}>
            <select className="adm-input" value={lot} onChange={(e) => setLot(e.target.value)} disabled={serials.length > 0}>
              <option value="">선택 안 함</option>
              {lotOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 content-start">
          <div className="grid grid-cols-2 gap-3">
            <Field label="라벨 크기 (QR 한 변)">
              <select className="adm-input" value={sizeId} onChange={(e) => setSizeId(e.target.value as SizeId)}>
                {SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="한 줄 개수">
              <select className="adm-input" value={cols} onChange={(e) => setCols(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}개
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="adm-label">표시 항목</legend>
            <div className="flex flex-wrap gap-4 text-[13px]">
              {([['sn', 'S/N'], ['mac', 'MAC'], ['lot', '로트']] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {rowWidthMm > A4_WIDTH_MM && (
            <p className="flex items-start gap-1.5 text-[12px] text-warning">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />한 줄이 약 {Math.round(rowWidthMm)}mm 로 A4 세로 폭({A4_WIDTH_MM}mm)을 넘습니다. 개수를 줄이거나 가로 방향으로 인쇄해 주세요.
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" className="adm-btn adm-btn-primary" disabled={loading || tooMany}>
              {loading && <Spinner />} 라벨 만들기
            </button>
          </div>
        </div>
      </form>

      <div className="no-print">
        <ErrorBox message={error} />
        {loaded && (
          <div className="mb-3 grid gap-2">
            <p className="text-[13px]">
              <b className="tabular-nums">{fmtNumber(items.length)}</b>개 라벨
              {loaded.truncated && <span className="text-warning"> · 최대 {fmtNumber(MAX_LABELS)}개까지만 불러왔습니다</span>}
            </p>
            {noMac > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg bg-warning/15 px-3 py-2 text-[12.5px] text-warning">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {fmtNumber(noMac)}개는 MAC 이 없어 SN 만 담긴 QR — 앱에서 BLE 자동 연결이 되지 않습니다. 라벨에 “MAC 없음”으로 표시됩니다(인쇄에는 나오지 않습니다).
              </p>
            )}
            {loaded.missing.length > 0 && (
              <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
                재고에 없어 라벨을 만들지 못한 SN {fmtNumber(loaded.missing.length)}개:
                <span className="mono ml-1 break-all">{loaded.missing.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="print-area qr-sheet adm-card p-4 overflow-x-auto">
          <div className="grid w-max" style={{ gridTemplateColumns: `repeat(${cols}, max-content)`, gap: `${GAP_MM}mm` }}>
            {items.map((it) => {
              const img = it.payload ? images[it.payload] : '';
              return (
                <div
                  key={it.serial}
                  className="qr-label flex flex-col items-center bg-white text-black border border-dashed border-gray-300 text-center"
                  style={{ padding: `${LABEL_PAD_MM}mm`, width: `${size.mm + LABEL_PAD_MM * 2}mm`, lineHeight: 1.2 }}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={`${it.serial} QR 코드`} style={{ width: `${size.mm}mm`, height: `${size.mm}mm`, imageRendering: 'pixelated' }} />
                  ) : (
                    <div className="flex items-center justify-center text-gray-500" style={{ width: `${size.mm}mm`, height: `${size.mm}mm`, fontSize: `${size.subPt}pt` }}>
                      {it.payload ? '생성 중…' : 'QR 없음'}
                    </div>
                  )}
                  {show.sn && (
                    <div className="mono font-bold break-all" style={{ fontSize: `${size.snPt}pt`, marginTop: '0.8mm' }}>
                      {it.serial}
                    </div>
                  )}
                  {show.mac && it.hasMac && (
                    <div className="mono break-all" style={{ fontSize: `${size.subPt}pt` }}>
                      {fmtMac(it.bleMac)}
                    </div>
                  )}
                  {show.lot && it.lotCode && (
                    <div className="break-all" style={{ fontSize: `${size.subPt}pt` }}>
                      {it.lotCode}
                    </div>
                  )}
                  {!it.hasMac && (
                    <div className="no-print font-semibold text-amber-600" style={{ fontSize: `${size.subPt}pt` }}>
                      MAC 없음
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-print adm-card p-10 text-center text-base-content/55">
          {loading ? <Spinner /> : loaded ? '만들 수 있는 라벨이 없습니다.' : 'SN 을 입력하거나 로트를 선택한 뒤 “라벨 만들기”를 눌러 주세요.'}
        </div>
      )}
    </div>
  );
}

export default function QrLabelsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center"><Spinner /></div>}>
      <QrLabels />
    </Suspense>
  );
}
