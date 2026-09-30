'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  ALARM_LABEL, DEVICE_STATUS, fmtAgo, fmtDateTime, fmtMac, fmtNumber, fmtRemaining, PROVIDER_LABEL, USER_STATUS,
} from '@/lib/format';
import { Panel, Pill, StatusPill } from '@/components/ui/adm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import type { AdminUser, UserAlarm, UserAppSetting, UserDataSummary, UserDevice, UserLogin, UserStats14d } from './types';

const GENDER_LABEL: Record<string, string> = { male: '남성', female: '여성' };
const UNIT_LABEL: Record<string, string> = { 'mg/dL': 'mg/dL', mmol: 'mmol/L', 'mmol/L': 'mmol/L' };
const NOTE_MAX = 2000;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** "2026-09-30 14:05 (3시간 전)" */
function When({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  return (
    <>
      {fmtDateTime(value)} <span className="text-base-content/55">({fmtAgo(value)})</span>
    </>
  );
}

export function ProfilePanel({ user }: { user: AdminUser }) {
  return (
    <Panel title="프로필" bodyClass="p-4">
      <dl className="adm-dl">
        <Row label="회원 ID">
          <span className="mono">{user.id}</span>
        </Row>
        <Row label="이메일">{user.email}</Row>
        <Row label="성">{user.lastName || '—'}</Row>
        <Row label="이름">{user.firstName || '—'}</Row>
        <Row label="표시 이름">{user.name || '—'}</Row>
        <Row label="생년월일">{user.dateOfBirth || '—'}</Row>
        <Row label="성별">{user.gender ? GENDER_LABEL[user.gender] || user.gender : '미지정'}</Row>
        <Row label="혈당 단위">{UNIT_LABEL[user.unit] || user.unit}</Row>
        <Row label="국가">{user.countryCode || '—'}</Row>
        <Row label="언어">{user.language || '—'}</Row>
        <Row label="가입 경로">
          {PROVIDER_LABEL[user.provider] || user.provider}
          {user.providerId && <span className="ml-1.5 mono text-base-content/55">{user.providerId}</span>}
        </Row>
        <Row label="비밀번호">{user.hasPassword ? '설정됨' : '없음(소셜 로그인만)'}</Row>
        <Row label="상태">
          <StatusPill map={USER_STATUS} value={user.status} />
        </Row>
        {user.status === 'suspended' && (
          <>
            <Row label="정지 사유">
              <span className="whitespace-pre-line">{user.suspendedReason || '—'}</span>
            </Row>
            <Row label="정지 일시">
              <When value={user.suspendedAt} />
            </Row>
          </>
        )}
        {user.status === 'deleted' && (
          <Row label="탈퇴 일시">
            <When value={user.deletedAt} />
          </Row>
        )}
        <Row label="가입일">{fmtDateTime(user.createdAt)}</Row>
        <Row label="마지막 로그인">
          <When value={user.lastLoginAt} />
        </Row>
        <Row label="마지막 접속">
          <When value={user.lastSeenAt} />
        </Row>
        <Row label="마지막 업로드">
          <When value={user.lastUploadAt} />
        </Row>
        <Row label="정보 수정일">{fmtDateTime(user.updatedAt)}</Row>
      </dl>
    </Panel>
  );
}

export function NotePanel({ user, canWrite, onSaved }: { user: AdminUser; canWrite: boolean; onSaved: () => void }) {
  const [note, setNote] = useState(user.adminNote);
  const [saving, setSaving] = useState(false);

  // 저장 후 다시 불러온 값으로 맞춘다(다른 작업으로 인한 새로 고침에서는 메모가 그대로라 입력 중인 내용이 유지된다).
  useEffect(() => setNote(user.adminNote), [user.adminNote]);

  const dirty = note !== user.adminNote;

  const save = async () => {
    setSaving(true);
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: { adminNote: note } });
      toast.success('메모를 저장했습니다');
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="관리자 메모" bodyClass="p-4 flex flex-col gap-2">
      <textarea
        className="adm-input min-h-[140px]"
        rows={6}
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        readOnly={!canWrite}
        aria-label="관리자 메모"
        placeholder={canWrite ? '상담 이력, 특이 사항 등 관리자끼리 공유할 내용을 적어 주세요. 회원에게는 보이지 않습니다.' : '메모가 없습니다'}
      />
      {canWrite && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-base-content/55 tabular-nums">
            {fmtNumber(note.length)} / {fmtNumber(NOTE_MAX)}자
          </span>
          <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={save} disabled={!dirty || saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      )}
    </Panel>
  );
}

const DEVICE_COLUMNS: Column<UserDevice>[] = [
  {
    key: 'serial',
    title: 'S/N',
    render: (d) => (
      <span className="inline-flex items-center gap-1.5">
        <Link href={`/devices/${encodeURIComponent(d.serial)}`} prefetch={false} className="mono font-semibold text-primary hover:underline">
          {d.serial}
        </Link>
        {!d.verified && (
          <Pill tone="amber" title="재고에 등록·확인되지 않은 S/N 입니다">
            미확인
          </Pill>
        )}
      </span>
    ),
  },
  { key: 'bleMac', title: 'MAC', render: (d) => <span className="mono">{fmtMac(d.bleMac)}</span> },
  { key: 'status', title: '상태', render: (d) => <StatusPill map={DEVICE_STATUS} value={d.status} /> },
  { key: 'startAt', title: '시작', render: (d) => fmtDateTime(d.startAt) },
  { key: 'endAt', title: '만료', render: (d) => fmtDateTime(d.endAt) },
  { key: 'remainingMs', title: '남은 시간', render: (d) => fmtRemaining(d.remainingMs) },
  { key: 'lotCode', title: '로트', render: (d) => d.lotCode || '—' },
];

export function DevicesPanel({ devices }: { devices: UserDevice[] }) {
  return (
    <Panel title="센서" right={<span className="text-base-content/60">{fmtNumber(devices.length)}개</span>}>
      <DataTable<UserDevice> columns={DEVICE_COLUMNS} rows={devices} rowKey={(d) => d.id} emptyText="등록한 센서가 없습니다" />
    </Panel>
  );
}

function pct(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

function mgdl(v: number | null): string {
  return v == null ? '—' : `${fmtNumber(v)} mg/dL`;
}

export function DataSummaryPanel({ userId, data, stats, canViewData }: { userId: string; data: UserDataSummary; stats: UserStats14d; canViewData: boolean }) {
  const th = stats.thresholds;
  const hasStats = stats.points > 0;
  return (
    <Panel
      title="데이터 요약"
      right={
        canViewData && (
          <Link href={`/data?userId=${encodeURIComponent(userId)}`} prefetch={false} className="text-primary font-semibold hover:underline">
            데이터 관리에서 보기
          </Link>
        )
      }
      bodyClass="p-4"
    >
      <dl className="adm-dl">
        <Row label="혈당 측정">{fmtNumber(data.totalPoints)}건</Row>
        <Row label="이벤트">{fmtNumber(data.eventCount)}건</Row>
        <Row label="첫 측정">{fmtDateTime(data.firstAt)}</Row>
        <Row label="마지막 측정">
          <When value={data.lastAt} />
        </Row>
        <Row label="마지막 값">
          {mgdl(data.lastValue)}
          {data.lastEqsn && <span className="ml-1.5 mono text-base-content/55">{data.lastEqsn}</span>}
        </Row>
      </dl>

      <div className="mt-4 pt-4 border-t border-base-300">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
          <h3 className="text-[13px] font-bold">최근 14일</h3>
          <span className="text-[11.5px] text-base-content/55">
            기준: 저혈당 {th.low} 미만 · 고혈당 {th.high} 초과 (mg/dL)
          </span>
        </div>
        {hasStats ? (
          <>
            <div
              className="flex h-2.5 rounded-full overflow-hidden bg-base-200 mb-3"
              role="img"
              aria-label={`저혈당 ${pct(stats.lowPct)}, 목표범위 ${pct(stats.inRangePct)}, 고혈당 ${pct(stats.highPct)}`}
            >
              <span className="bg-error" style={{ width: `${stats.lowPct ?? 0}%` }} />
              <span className="bg-success" style={{ width: `${stats.inRangePct ?? 0}%` }} />
              <span className="bg-warning" style={{ width: `${stats.highPct ?? 0}%` }} />
            </div>
            <dl className="adm-dl">
              <Row label="측정 수">{fmtNumber(stats.points)}건</Row>
              <Row label="평균">{mgdl(stats.avg)}</Row>
              <Row label="최저 / 최고">
                {fmtNumber(stats.min)} / {fmtNumber(stats.max)} mg/dL
              </Row>
              <Row label="저혈당">
                <span className="text-error font-semibold">{pct(stats.lowPct)}</span>
              </Row>
              <Row label="목표범위">
                <span className="text-success font-semibold">{pct(stats.inRangePct)}</span>
                <span className="ml-1.5 text-base-content/55">
                  ({th.low}~{th.high})
                </span>
              </Row>
              <Row label="고혈당">
                <span className="text-warning font-semibold">{pct(stats.highPct)}</span>
              </Row>
            </dl>
          </>
        ) : (
          <p className="text-[13px] text-base-content/55">최근 14일 동안 측정된 혈당 데이터가 없습니다.</p>
        )}
      </div>
    </Panel>
  );
}

function OnOff({ on }: { on: boolean }) {
  return <Pill tone={on ? 'green' : 'gray'}>{on ? '켬' : '끔'}</Pill>;
}

const ALARM_COLUMNS: Column<UserAlarm>[] = [
  { key: 'type', title: '종류', render: (a) => ALARM_LABEL[a.type] || a.type },
  { key: 'enabled', title: '사용', render: (a) => <OnOff on={a.enabled} /> },
  { key: 'threshold', title: '기준값', num: true, render: (a) => (a.threshold == null ? '—' : fmtNumber(a.threshold)) },
  { key: 'repeatMin', title: '반복', render: (a) => (a.repeatMin == null ? '—' : `${a.repeatMin}분`) },
  {
    key: 'sound',
    title: '소리/진동',
    render: (a) => `${a.sound ? '소리 켬' : '소리 끔'} / ${a.vibrate ? '진동 켬' : '진동 끔'}`,
  },
  { key: 'quiet', title: '방해금지 시간', render: (a) => (a.quietFrom || a.quietTo ? `${a.quietFrom || '—'} ~ ${a.quietTo || '—'}` : '—') },
];

export function AlarmsPanel({ alarms, appSetting }: { alarms: UserAlarm[]; appSetting: UserAppSetting | null }) {
  return (
    <Panel title="알람 설정">
      <DataTable<UserAlarm> columns={ALARM_COLUMNS} rows={alarms} rowKey={(a) => a.type} emptyText="설정한 알람이 없습니다(앱 기본값 사용)" />
      <div className="p-4 border-t border-base-300">
        <h3 className="text-[13px] font-bold mb-2">앱 설정</h3>
        {appSetting ? (
          <dl className="adm-dl">
            <Row label="단위">{UNIT_LABEL[appSetting.unit] || appSetting.unit}</Row>
            <Row label="알림">
              <OnOff on={appSetting.notifications} />
            </Row>
            <Row label="다크모드">
              <OnOff on={appSetting.darkMode} />
            </Row>
            <Row label="변경 일시">{fmtDateTime(appSetting.updatedAt)}</Row>
          </dl>
        ) : (
          <p className="text-[13px] text-base-content/55">앱에서 저장한 설정이 없습니다.</p>
        )}
      </div>
    </Panel>
  );
}

const LOGIN_METHOD: Record<string, string> = { password: '비밀번호', google: 'Google', kakao: 'Kakao', apple: 'Apple' };
const LOGIN_REASON: Record<string, string> = {
  bad_password: '비밀번호 불일치',
  unknown_user: '없는 계정',
  account_suspended: '정지된 계정',
  account_deleted: '탈퇴한 계정',
};

const LOGIN_COLUMNS: Column<UserLogin>[] = [
  { key: 'at', title: '시각', render: (l) => fmtDateTime(l.at, true) },
  { key: 'success', title: '결과', render: (l) => <Pill tone={l.success ? 'green' : 'red'}>{l.success ? '성공' : '실패'}</Pill> },
  { key: 'method', title: '방법', render: (l) => (l.method ? LOGIN_METHOD[l.method] || l.method : '—') },
  { key: 'reason', title: '사유', render: (l) => (l.reason ? LOGIN_REASON[l.reason] || l.reason : '—') },
  { key: 'ip', title: 'IP', render: (l) => <span className="mono">{l.ip || '—'}</span> },
];

export function LoginsPanel({ logins }: { logins: UserLogin[] }) {
  return (
    <Panel title="로그인 이력" right={<span className="text-base-content/60">최근 20건</span>}>
      <DataTable<UserLogin> columns={LOGIN_COLUMNS} rows={logins} rowKey={(l) => `${l.at}|${l.ip}|${l.success}`} emptyText="로그인 기록이 없습니다" />
    </Panel>
  );
}
