'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ErrorBox, Field } from '@/components/ui/adm';
import { api, errorMessage } from '@/lib/api';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/format';

export type Notice = {
  id: string;
  title: string;
  body: string;
  language: string;
  pinned: boolean;
  active: boolean;
  publishAt: string | null;
  expireAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export const NOTICE_LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'ko', label: '한국어 (ko)' },
  { value: 'en', label: 'English (en)' },
];

const TITLE_MAX = 200;
const BODY_MAX = 20000;

type Props = {
  /** null 이면 새 공지 작성 */
  notice: Notice | null;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
};

/** 공지 작성·수정·삭제 모달. 쓰기 권한이 없으면 읽기 전용으로 보여 준다. */
export default function NoticeEditor({ notice, canWrite, onClose, onChanged }: Props) {
  const [title, setTitle] = useState(notice?.title ?? '');
  const [body, setBody] = useState(notice?.body ?? '');
  const [language, setLanguage] = useState(notice?.language ?? '');
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [active, setActive] = useState(notice?.active ?? true);
  const [publishAt, setPublishAt] = useState(toLocalInput(notice ? notice.publishAt : new Date()));
  const [expireAt, setExpireAt] = useState(toLocalInput(notice?.expireAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 목록에 없는 언어 코드로 저장된 공지도 값이 바뀌지 않게 선택지에 넣는다.
  const languages = NOTICE_LANGUAGES.some((l) => l.value === language) ? NOTICE_LANGUAGES : [...NOTICE_LANGUAGES, { value: language, label: language }];

  async function save() {
    if (!title.trim()) return setError('제목을 입력해 주세요.');
    const publishIso = fromLocalInput(publishAt);
    const expireIso = fromLocalInput(expireAt);
    if (publishIso && expireIso && expireIso <= publishIso) return setError('게시 종료는 게시 시작보다 뒤여야 합니다.');
    setBusy(true);
    setError('');
    try {
      const payload = { title: title.trim(), body, language, pinned, active, publishAt: publishIso, expireAt: expireIso };
      if (notice) await api(`/notices/${notice.id}`, { method: 'PATCH', body: payload });
      else await api('/notices', { body: payload });
      toast.success(notice ? '공지를 수정했습니다.' : '공지를 등록했습니다.');
      onChanged();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!notice) return;
    const ok = await dialog.confirm(`"${notice.title}" 공지를 삭제할까요?\n앱에서도 바로 사라지며 되돌릴 수 없습니다.`, { danger: true, title: '공지 삭제', okText: '삭제' });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/notices/${notice.id}`, { method: 'DELETE' });
      toast.success('공지를 삭제했습니다.');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const footer = canWrite ? (
    <>
      {notice && (
        <button type="button" className="adm-btn adm-btn-danger mr-auto" onClick={remove} disabled={busy}>
          <Trash2 size={14} />
          삭제
        </button>
      )}
      <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
        취소
      </button>
      <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>
        {busy ? '저장 중…' : '저장'}
      </button>
    </>
  ) : (
    <button type="button" className="adm-btn" onClick={onClose}>
      닫기
    </button>
  );

  return (
    <Modal open title={!notice ? '공지 작성' : canWrite ? '공지 수정' : '공지 보기'} onClose={onClose} footer={footer} width={680}>
      <ErrorBox message={error} />
      <div className="grid gap-3">
        <Field label="제목">
          <input className="adm-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} disabled={!canWrite} autoFocus={canWrite} />
        </Field>
        <Field label="본문" hint={`${body.length.toLocaleString('ko-KR')} / ${BODY_MAX.toLocaleString('ko-KR')}자 · 줄바꿈은 앱에 그대로 표시됩니다`}>
          <textarea
            className="adm-input whitespace-pre-wrap"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={BODY_MAX}
            disabled={!canWrite}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="언어" hint="전체 = 모든 언어 사용자에게 표시">
            <select className="adm-input" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!canWrite}>
              {languages.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="게시 시작 (한국시간)" hint="비우면 저장 시각부터">
            <input className="adm-input" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} disabled={!canWrite} />
          </Field>
          <Field label="게시 종료 (한국시간)" hint="비우면 무기한">
            <input className="adm-input" type="datetime-local" value={expireAt} onChange={(e) => setExpireAt(e.target.value)} disabled={!canWrite} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={pinned} onChange={(e) => setPinned(e.target.checked)} disabled={!canWrite} />
            상단 고정
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!canWrite} />
            게시 (끄면 앱에 표시되지 않습니다)
          </label>
        </div>
        {notice && (
          <p className="text-[11.5px] text-base-content/55">
            작성 {notice.createdBy || '—'} · {fmtDateTime(notice.createdAt)} / 최근 수정 {notice.updatedBy || '—'} · {fmtDateTime(notice.updatedAt)}
          </p>
        )}
      </div>
    </Modal>
  );
}
