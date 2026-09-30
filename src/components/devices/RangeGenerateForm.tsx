'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { fmtNumber } from '@/lib/format';
import { Field } from '@/components/ui/adm';
import LotInput from './LotInput';
import type { GeneratePreview, GenerateResult } from './types';

const MAX_COUNT = 2000;

type Form = { model: string; yearCode: string; sample: boolean; from: string; count: string; lotCode: string };

function failMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === 'pattern_mismatch' && typeof e.data?.example === 'string') {
    return `${errorMessage(e)} (예: ${e.data.example})`;
  }
  return errorMessage(e);
}

/** SN 범위 생성: 먼저 dryRun 으로 범위·중복을 확인한 뒤 생성한다. */
export default function RangeGenerateForm({ lots }: { lots: string[] }) {
  const [form, setForm] = useState<Form>({ model: 'C21', yearCode: '', sample: false, from: '1', count: '100', lotCode: '' });
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState(false);

  // 입력이 바뀌면 이전 미리보기는 더 이상 맞지 않는다.
  const change = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setPreview(null);
    setResult(null);
  };

  const body = () => ({
    model: form.model.trim().toUpperCase(),
    yearCode: form.yearCode.trim().toUpperCase(),
    sample: form.sample,
    from: Number(form.from),
    count: Number(form.count),
    lotCode: form.lotCode.trim() || undefined,
  });

  const onPreview = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setPreview(await api<GeneratePreview>('/devices/generate', { body: { ...body(), dryRun: true } }));
    } catch (err) {
      setPreview(null);
      toast.error(failMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onGenerate = async () => {
    setBusy(true);
    try {
      const r = await api<GenerateResult>('/devices/generate', { body: body() });
      setResult(r);
      setPreview(null);
      toast.success(`SN ${fmtNumber(r.created)}건을 생성했습니다`);
    } catch (err) {
      toast.error(failMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const lot = form.lotCode.trim();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <form className="adm-card p-4 grid grid-cols-2 gap-3 content-start" onSubmit={onPreview}>
        <Field label="모델" hint="C + 숫자 2자리">
          <input className="adm-input mono" value={form.model} onChange={(e) => change({ model: e.target.value.toUpperCase() })} maxLength={3} pattern="[Cc][0-9]{2}" required />
        </Field>
        <Field label="연도 코드" hint="영문 대문자 1자 (예: Z)">
          <input className="adm-input mono" value={form.yearCode} onChange={(e) => change({ yearCode: e.target.value.toUpperCase() })} maxLength={1} pattern="[A-Za-z]" required placeholder="Z" />
        </Field>
        <Field label="시작 번호" hint="0 ~ 99999">
          <input type="number" className="adm-input" value={form.from} onChange={(e) => change({ from: e.target.value })} min={0} max={99999} step={1} required />
        </Field>
        <Field label="개수" hint={`최대 ${fmtNumber(MAX_COUNT)}개`}>
          <input type="number" className="adm-input" value={form.count} onChange={(e) => change({ count: e.target.value })} min={1} max={MAX_COUNT} step={1} required />
        </Field>
        <Field label="로트 (선택)" hint="없는 코드는 새로 만들어집니다." className="col-span-2 sm:col-span-1">
          <LotInput lots={lots} value={form.lotCode} onChange={(lotCode) => change({ lotCode })} />
        </Field>
        <label className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:mt-6 text-[13px]">
          <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={form.sample} onChange={(e) => change({ sample: e.target.checked })} />
          샘플 (SN 에 S 가 들어갑니다)
        </label>
        <p className="col-span-2 text-[12px] text-base-content/60">
          이 단계에서는 MAC 을 알 수 없어 비워 둡니다. 생산 후 “CSV 가져오기”로 같은 SN 에 MAC 을 채울 수 있습니다.
        </p>
        <div className="col-span-2 flex justify-end">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
            미리보기
          </button>
        </div>
      </form>

      <div className="adm-card p-4" aria-live="polite">
        <h2 className="text-[13px] font-bold mb-2">결과</h2>
        {preview ? (
          <>
            <p className="text-[14px]">
              <b className="mono !text-[14px]">{preview.first}</b> ~ <b className="mono !text-[14px]">{preview.last}</b>
            </p>
            <p className="mt-1">
              새로 생성 <b className="text-primary">{fmtNumber(preview.willCreate)}건</b>, 이미 있음 <b>{fmtNumber(preview.alreadyExists)}건</b>
              {lot && <> · 로트 {lot}</>}
            </p>
            <button type="button" className="adm-btn adm-btn-primary mt-3" disabled={busy || preview.willCreate === 0} onClick={onGenerate}>
              {fmtNumber(preview.willCreate)}건 생성
            </button>
            {preview.willCreate === 0 && <p className="mt-2 text-[12px] text-base-content/60">범위의 SN 이 모두 이미 있어 생성할 것이 없습니다.</p>}
          </>
        ) : result ? (
          <>
            <p className="text-[14px]">
              <b className="mono !text-[14px]">{result.first}</b> ~ <b className="mono !text-[14px]">{result.last}</b>
            </p>
            <p className="mt-1">
              생성 <b className="text-success">{fmtNumber(result.created)}건</b>, 이미 있어 건너뜀 <b>{fmtNumber(result.alreadyExists)}건</b>
            </p>
            <Link href={lot ? `/devices?lot=${encodeURIComponent(lot)}` : '/devices?status=stock'} prefetch={false} className="adm-btn adm-btn-sm mt-3">
              목록에서 보기
            </Link>
          </>
        ) : (
          <p className="text-base-content/55">범위를 입력하고 미리보기를 누르면 첫 SN ~ 마지막 SN 과 생성 건수를 보여 줍니다.</p>
        )}
      </div>
    </div>
  );
}
