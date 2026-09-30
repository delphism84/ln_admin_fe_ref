'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { dialog } from '@/lib/dialog';
import { toast } from '@/lib/toast';
import { ErrorBox, Field } from '@/components/ui/adm';
import Modal from '@/components/ui/Modal';
import type { AdminUser } from './types';

const FORM_ID = 'user-password-form';
const MIN_LENGTH = 8;

/** 기존 비밀번호 없이 새 비밀번호를 지정한다. 회원의 기존 세션은 모두 로그아웃된다. */
export default function UserPasswordModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const problem =
    password.length > 0 && password.length < MIN_LENGTH
      ? `비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`
      : confirm.length > 0 && password !== confirm
        ? '비밀번호 확인이 일치하지 않습니다.'
        : '';
  const ready = password.length >= MIN_LENGTH && password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    const ok = await dialog.confirm(`${user.email} 회원의 비밀번호를 새로 설정할까요?\n회원의 기존 로그인은 모두 해제됩니다.`, {
      title: '비밀번호 재설정',
      okText: '재설정',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api(`/users/${user.id}/password`, { body: { password } });
      toast.success('비밀번호를 재설정했습니다');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="비밀번호 재설정"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="submit" form={FORM_ID} className="adm-btn adm-btn-primary" disabled={!ready || saving}>
            {saving ? '처리 중…' : '재설정'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="grid gap-3">
        <p className="text-[13px] leading-relaxed text-base-content/75">
          <b className="text-base-content">{user.email}</b> 회원의 비밀번호를 새로 지정합니다. 재설정하면 회원이 로그인해 둔 모든 기기에서 로그아웃되며, 새
          비밀번호로 다시 로그인해야 합니다. 새 비밀번호는 회원에게 직접 안내해 주세요.
        </p>
        <ErrorBox message={problem} />
        <Field label="새 비밀번호" hint={`${MIN_LENGTH}자 이상`}>
          <input
            type="password"
            className="adm-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
          />
        </Field>
        <Field label="새 비밀번호 확인">
          <input type="password" className="adm-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
      </form>
    </Modal>
  );
}
