'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, RotateCcw, Save, X } from 'lucide-react';
import { ErrorBox, Field, PageTitle, Panel, Pill, Spinner } from '@/components/ui/adm';
import ResetPanel from '@/components/system/ResetPanel';
import {
  INT_RANGE,
  buildPatch,
  compilePattern,
  ipAllowed,
  parseAllowlist,
  toForm,
  validateForm,
  type SettingsForm,
  type SettingsResponse,
  type SnPolicy,
  type SystemSettings,
} from '@/components/system/settingsModel';
import { api, errorMessage } from '@/lib/api';
import { useAuth, type Admin } from '@/lib/auth';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';

const SAMPLE_MAC = '04AC44111102';
const DEFAULT_SAMPLE_SN = 'C21Z00102';

const SN_POLICIES: { value: SnPolicy; title: string; desc: string }[] = [
  { value: 'flag', title: '표시만', desc: "재고에 없는 SN 도 앱 등록을 허용하고 '미확인'으로 표시" },
  { value: 'block', title: '차단', desc: '재고에 없는 SN 은 앱 등록을 거절 — 이미 출고된 센서를 모두 재고로 등록한 뒤 켜세요' },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="mt-1 block text-[11.5px] font-medium text-error">
      {message}
    </span>
  );
}

function IntField({
  label, name, form, errors, defaults, unit, desc, onChange,
}: {
  label: string;
  name: keyof typeof INT_RANGE;
  form: SettingsForm;
  errors: Partial<Record<keyof SettingsForm, string>>;
  defaults: SystemSettings;
  unit: string;
  desc?: ReactNode;
  onChange: (patch: Partial<SettingsForm>) => void;
}) {
  const [min, max] = INT_RANGE[name];
  return (
    <Field
      label={label}
      hint={
        <>
          {desc && <span className="block">{desc}</span>}
          {min}~{max}
          {unit} · 기본값 {defaults[name]}
          {unit}
        </>
      }
    >
      <input
        className="adm-input tabular-nums"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={form[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
        aria-invalid={!!errors[name]}
      />
      <FieldError message={errors[name]} />
    </Field>
  );
}

export default function SystemSettingsPage() {
  const { admin, can } = useAuth();
  const canManage = can('settings.manage');
  const [server, setServer] = useState<SystemSettings | null>(null);
  const [defaults, setDefaults] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sampleSn, setSampleSn] = useState(DEFAULT_SAMPLE_SN);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const r = await api<SettingsResponse>('/settings');
      setServer(r.settings);
      setDefaults(r.defaults);
      setForm(toForm(r.settings));
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const check = useMemo(() => (form ? validateForm(form) : null), [form]);
  const patch = useMemo(() => (check?.values && server ? buildPatch(check.values, server) : {}), [check, server]);
  const changed = Object.keys(patch).length;
  const dirty = !!form && !!server && JSON.stringify(form) !== JSON.stringify(toForm(server));

  if (!form || !server || !defaults || !check) {
    return (
      <div>
        <PageTitle title="시스템 설정" />
        {loadError ? (
          <div className="adm-card p-4">
            <ErrorBox message={loadError} />
            <button type="button" className="adm-btn" onClick={() => void load()}>
              다시 시도
            </button>
          </div>
        ) : (
          <div className="adm-card p-8 flex items-center justify-center gap-2 text-[13px] text-base-content/60">
            <Spinner />
            불러오는 중…
          </div>
        )}
      </div>
    );
  }

  const errors = check.errors;
  // 로그인 세션의 admin 에는 서버가 lastLoginIp 도 담아 준다(admin_api.md 의 admin 형식).
  const myIp = (admin as (Admin & { lastLoginIp?: string | null }) | null)?.lastLoginIp || '';
  const update = (p: Partial<SettingsForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function choosePolicy(next: SnPolicy) {
    if (!form || next === form.snPolicy) return;
    if (next === 'block') {
      const ok = await dialog.confirm(
        '차단으로 바꾸면 재고(SN 대장)에 없는 센서는 앱에서 등록할 수 없습니다.\n이미 출고된 센서가 재고에 모두 등록되어 있지 않으면 정상 제품을 가진 회원도 등록이 거절됩니다.\n\n차단 정책을 선택할까요? (저장해야 적용됩니다)',
        { danger: true, title: '미등록 SN 차단', okText: '차단 선택' },
      );
      if (!ok) return;
    }
    update({ snPolicy: next });
  }

  async function toggleIpEnforce(next: boolean) {
    if (next) {
      const ok = await dialog.confirm(
        'IP 제한을 켜면 허용 목록에 없는 IP 에서는 관리자 콘솔에 로그인할 수 없고, 이미 로그인한 관리자도 즉시 차단됩니다.\n지금 접속 중인 본인의 IP 가 목록에 없으면 본인도 잠깁니다(서버 자체의 루프백 접속만 항상 허용).\n\nIP 제한을 켤까요? (저장해야 적용됩니다)',
        { danger: true, title: '관리자 접속 IP 제한', okText: '제한 켜기' },
      );
      if (!ok) return;
    }
    update({ adminIpEnforce: next });
  }

  async function save() {
    if (!check?.values || changed === 0) return;
    const values = check.values;
    if (values.adminIpEnforce && ('adminIpEnforce' in patch || 'adminIpAllowlist' in patch) && myIp && !ipAllowed(myIp, values.adminIpAllowlist)) {
      const ok = await dialog.confirm(
        `마지막 로그인 IP(${myIp})가 허용 목록에 없습니다.\n이대로 저장하면 본인도 콘솔에 접속하지 못할 수 있습니다. 그래도 저장할까요?`,
        { danger: true, title: '본인 IP 가 목록에 없음', okText: '그래도 저장' },
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await api('/settings', { method: 'PUT', body: patch });
      toast.success('설정을 저장했습니다.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const allowlist = parseAllowlist(form.adminIpAllowlist);
  const myIpListed = myIp ? ipAllowed(myIp, allowlist) : null;

  const pattern = compilePattern(form.snPattern);
  const sn = sampleSn.trim().toUpperCase();
  const match = pattern && sn ? pattern.exec(sn) : null;
  const yearCode = match && /^[A-Z]$/.test(match[2] || '') ? match[2] : '';
  const yearOfCode = yearCode ? form.yearCodes.find((r) => r.code.trim().toUpperCase() === yearCode)?.year : undefined;
  const mfgId = form.qrManufacturerId.trim().replace(/^0x/i, '').toUpperCase();
  const qrPreview = `${form.qrAdvName.trim()};0x${mfgId}${SAMPLE_MAC};0x${sn || DEFAULT_SAMPLE_SN}`;

  const setYearRow = (i: number, p: Partial<{ code: string; year: string }>) =>
    update({ yearCodes: form.yearCodes.map((r, idx) => (idx === i ? { ...r, ...p } : r)) });

  return (
    <div className="max-w-[980px]">
      <PageTitle
        title="시스템 설정"
        desc={canManage ? '값을 바꾼 뒤 아래 저장을 눌러야 적용됩니다.' : '조회 전용입니다. 변경은 시스템 설정 권한이 있는 관리자만 할 수 있습니다.'}
      />

      <div className="grid gap-4">
        <Panel title="센서" bodyClass="p-4">
          <fieldset disabled={!canManage} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntField
              label="유효기간(일)"
              name="eqValidityDays"
              unit="일"
              desc="앱 등록 시작시각 + 이 기간이 만료 시각입니다. 앱(16일)과 같게 유지하세요."
              form={form}
              errors={errors}
              defaults={defaults}
              onChange={update}
            />
            <IntField
              label="종료 임박 기준(시간)"
              name="endingSoonHours"
              unit="시간"
              desc="만료까지 남은 시간이 이 값 이하인 센서를 '종료 임박'으로 표시합니다."
              form={form}
              errors={errors}
              defaults={defaults}
              onChange={update}
            />
          </fieldset>
        </Panel>

        <Panel title="SN·QR 규칙" bodyClass="p-4 grid gap-4">
          <fieldset disabled={!canManage} className="grid gap-4">
            <div role="radiogroup" aria-labelledby="sn-policy-label">
              <span id="sn-policy-label" className="adm-label">
                미등록 SN 정책 <span className="font-normal text-base-content/55">· 기본값 {SN_POLICIES.find((p) => p.value === defaults.snPolicy)?.title}</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SN_POLICIES.map((p) => {
                  const on = form.snPolicy === p.value;
                  return (
                    <label
                      key={p.value}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${on ? 'border-primary bg-primary/5' : 'border-base-300 hover:bg-base-200'}`}
                    >
                      <input
                        type="radio"
                        name="snPolicy"
                        className="radio radio-sm radio-primary mt-0.5"
                        checked={on}
                        onChange={() => void choosePolicy(p.value)}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold">
                          {p.title} <span className="mono font-normal text-[11.5px] text-base-content/55">({p.value})</span>
                        </span>
                        <span className="block mt-0.5 text-[12px] text-base-content/70">{p.desc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Field label="SN 형식 정규식" hint={<>기본값 <span className="mono">{defaults.snPattern}</span> · 그룹 순서: 모델, 연도 코드, 샘플(S), 일련번호</>}>
              <input
                className="adm-input mono"
                value={form.snPattern}
                onChange={(e) => update({ snPattern: e.target.value })}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!!errors.snPattern}
              />
              <FieldError message={errors.snPattern} />
            </Field>

            <div>
              <span className="adm-label">
                연도 코드 표{' '}
                <span className="font-normal text-base-content/55">
                  · 기본값 {Object.entries(defaults.yearCodes).map(([c, y]) => `${c}=${y}`).join(', ') || '없음'}
                </span>
              </span>
              <div className="grid gap-2 max-w-[340px]">
                {form.yearCodes.length === 0 && <p className="text-[12.5px] text-base-content/55">등록된 연도 코드가 없습니다.</p>}
                {form.yearCodes.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="adm-input mono !w-16 text-center"
                      value={row.code}
                      maxLength={1}
                      onChange={(e) => setYearRow(i, { code: e.target.value.toUpperCase() })}
                      aria-label={`연도 코드 ${i + 1} (A–Z 한 글자)`}
                      placeholder="Z"
                    />
                    <span className="text-base-content/50" aria-hidden="true">→</span>
                    <input
                      className="adm-input tabular-nums"
                      type="number"
                      inputMode="numeric"
                      min={2000}
                      max={2100}
                      value={row.year}
                      onChange={(e) => setYearRow(i, { year: e.target.value })}
                      aria-label={`연도 코드 ${i + 1} 의 연도`}
                      placeholder="2025"
                    />
                    {canManage && (
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost adm-btn-sm !px-1.5 shrink-0"
                        onClick={() => update({ yearCodes: form.yearCodes.filter((_, idx) => idx !== i) })}
                        aria-label={`연도 코드 ${row.code || i + 1} 삭제`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {canManage && (
                  <div>
                    <button type="button" className="adm-btn adm-btn-sm" onClick={() => update({ yearCodes: [...form.yearCodes, { code: '', year: '' }] })}>
                      <Plus size={13} />
                      코드 추가
                    </button>
                  </div>
                )}
              </div>
              <FieldError message={errors.yearCodes} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="QR 광고 이름" hint={<>센서 BLE 광고 이름 · 기본값 <span className="mono">{defaults.qrAdvName}</span></>}>
                <input
                  className="adm-input mono"
                  value={form.qrAdvName}
                  maxLength={32}
                  onChange={(e) => update({ qrAdvName: e.target.value })}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!!errors.qrAdvName}
                />
                <FieldError message={errors.qrAdvName} />
              </Field>
              <Field label="QR 제조자 ID" hint={<>16진수 4자리 · 기본값 <span className="mono">{defaults.qrManufacturerId}</span></>}>
                <input
                  className="adm-input mono"
                  value={form.qrManufacturerId}
                  maxLength={6}
                  onChange={(e) => update({ qrManufacturerId: e.target.value.toUpperCase() })}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!!errors.qrManufacturerId}
                />
                <FieldError message={errors.qrManufacturerId} />
              </Field>
            </div>
          </fieldset>

          <div className="rounded-lg bg-base-200 p-3 grid gap-3">
            <Field label="예시 SN (규칙 확인용 — 저장되지 않습니다)" className="max-w-[260px]">
              <input className="adm-input mono" value={sampleSn} onChange={(e) => setSampleSn(e.target.value)} spellCheck={false} autoComplete="off" placeholder={DEFAULT_SAMPLE_SN} />
            </Field>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]" aria-live="polite">
              {!pattern ? (
                <Pill tone="red">정규식 오류</Pill>
              ) : !sn ? (
                <span className="text-base-content/55">SN 을 입력하면 형식이 맞는지 확인합니다.</span>
              ) : match ? (
                <>
                  <Pill tone="green">형식 일치</Pill>
                  {yearCode &&
                    (yearOfCode ? (
                      <span>
                        연도 코드 <span className="mono font-semibold">{yearCode}</span> → {yearOfCode}년
                      </span>
                    ) : (
                      <Pill tone="amber">연도 코드 {yearCode} 가 표에 없음</Pill>
                    ))}
                </>
              ) : (
                <Pill tone="red">형식 불일치</Pill>
              )}
            </div>
            <div>
              <span className="adm-label">QR 문자열 미리보기 (MAC 은 예시)</span>
              <code className="block mono text-[12.5px] break-all px-3 py-2 rounded-lg bg-base-100 border border-base-300">{qrPreview}</code>
              <span className="mt-1 block text-[11.5px] text-base-content/55">
                형식: <span className="mono">&lt;광고 이름&gt;;0x&lt;제조자 ID&gt;&lt;MAC 12자리&gt;;0x&lt;SN&gt;</span>
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="운영" bodyClass="p-4">
          <fieldset disabled={!canManage} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntField
              label="동기화 이상 기준(시간)"
              name="syncGapHours"
              unit="시간"
              desc="센서 사용 중인데 이 시간 이상 혈당 업로드가 없으면 '동기화 이상'으로 봅니다."
              form={form}
              errors={errors}
              defaults={defaults}
              onChange={update}
            />
            <IntField
              label="관리자 세션 시간(시간)"
              name="adminSessionHours"
              unit="시간"
              desc="로그인 후 이 시간이 지나면 다시 로그인해야 합니다(사용 중에는 자동 연장)."
              form={form}
              errors={errors}
              defaults={defaults}
              onChange={update}
            />
          </fieldset>
        </Panel>

        <Panel title="접속 제한" bodyClass="p-4">
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary mt-0.5"
                checked={form.adminIpEnforce}
                onChange={(e) => void toggleIpEnforce(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">허용한 IP 에서만 관리자 콘솔 접속</span>
                <span className="block text-[12px] text-base-content/65">기본값 {defaults.adminIpEnforce ? '켜짐' : '꺼짐'} · 꺼져 있으면 아래 목록은 적용되지 않습니다.</span>
              </span>
            </label>

            <p className="px-3 py-2 rounded-lg bg-warning/15 text-warning text-[12.5px] font-medium">
              주의: 제한을 켠 상태에서 본인 IP 가 목록에 없으면 저장 즉시 본인도 콘솔에 접속할 수 없게 됩니다. 서버 자체(루프백 127.0.0.1)에서의 접속만 항상 허용됩니다.
            </p>

            <Field
              label="허용 IP 목록"
              hint={
                <>
                  한 줄에 하나씩. 정확한 IP(<span className="mono">203.0.113.7</span>) 또는 <span className="mono">.</span> 으로 끝나는 앞부분(<span className="mono">10.0.0.</span>) · 현재 {allowlist.length}개
                </>
              }
            >
              <textarea
                className="adm-input mono"
                rows={5}
                value={form.adminIpAllowlist}
                onChange={(e) => update({ adminIpAllowlist: e.target.value })}
                spellCheck={false}
                placeholder={'203.0.113.7\n10.0.0.'}
                aria-invalid={!!errors.adminIpAllowlist}
              />
              <FieldError message={errors.adminIpAllowlist} />
            </Field>

            {myIp && (
              <p className="flex flex-wrap items-center gap-2 text-[12.5px]">
                내 마지막 로그인 IP <span className="mono font-semibold">{myIp}</span>
                {myIpListed ? <Pill tone="green">목록에 포함</Pill> : <Pill tone={form.adminIpEnforce ? 'red' : 'gray'}>목록에 없음</Pill>}
                <span className="text-base-content/55">(프록시·VPN 환경에서는 실제 접속 IP 와 다를 수 있습니다)</span>
              </p>
            )}
          </fieldset>
        </Panel>

        {canManage && (
          <div className="adm-card sticky bottom-3 z-10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <span className="text-[12.5px] text-base-content/70">
              {Object.keys(errors).length > 0 ? (
                <span className="text-error font-semibold">입력 오류가 있는 항목을 확인해 주세요.</span>
              ) : changed > 0 ? (
                <>
                  변경된 항목 <b className="text-base-content">{changed}</b>개
                </>
              ) : (
                '변경된 내용이 없습니다.'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className="adm-btn" onClick={() => setForm(toForm(server))} disabled={!dirty || saving}>
                <RotateCcw size={14} />
                되돌리기
              </button>
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => void save()} disabled={changed === 0 || saving}>
                <Save size={14} />
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )}

        {can('system.reset') && <ResetPanel />}
      </div>
    </div>
  );
}
