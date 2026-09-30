'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Field } from '@/components/ui/adm';
import Modal from '@/components/ui/Modal';
import type { AdminUser, UserPatch } from './types';

const EDIT_KEYS = ['email', 'firstName', 'lastName', 'name', 'dateOfBirth', 'gender', 'unit', 'countryCode', 'language'] as const;
type EditKey = (typeof EDIT_KEYS)[number];
type EditForm = Record<EditKey, string>;

const FORM_ID = 'user-edit-form';

function toForm(user: AdminUser): EditForm {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    unit: user.unit,
    countryCode: user.countryCode,
    language: user.language,
  };
}

/** 회원 정보 수정. 열릴 때마다 새로 마운트해 현재 값으로 시작한다. 바뀐 항목만 보낸다. */
export default function UserEditModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EditForm>(() => toForm(user));
  const [saving, setSaving] = useState(false);

  const set = (key: EditKey, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const original = toForm(user);
    const patch: UserPatch = {};
    for (const key of EDIT_KEYS) {
      const value = form[key].trim();
      if (value !== original[key]) patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      toast.info('변경된 내용이 없습니다');
      return;
    }
    if (patch.email !== undefined && !patch.email) {
      toast.error('이메일을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: patch });
      toast.success('회원 정보를 저장했습니다');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // 예전 데이터에 male/female 외의 값이 들어 있으면 선택지에 그대로 보여 준다(저장하지 않으면 바뀌지 않는다).
  const legacyGender = form.gender && !['male', 'female'].includes(form.gender) ? form.gender : '';
  const legacyUnit = !['mg/dL', 'mmol'].includes(form.unit) ? form.unit : '';

  return (
    <Modal
      open
      title="회원 정보 수정"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="submit" form={FORM_ID} className="adm-btn adm-btn-primary" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="이메일" className="sm:col-span-2" hint="로그인 아이디로 쓰입니다. 다른 회원이 쓰는 이메일로는 바꿀 수 없습니다.">
          <input type="email" className="adm-input" value={form.email} onChange={(e) => set('email', e.target.value)} required maxLength={100} />
        </Field>
        <Field label="성 (lastName)">
          <input className="adm-input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} />
        </Field>
        <Field label="이름 (firstName)">
          <input className="adm-input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} />
        </Field>
        <Field label="표시 이름 (name)" className="sm:col-span-2" hint="입력하면 성·이름 대신 이 값이 회원 이름으로 표시됩니다.">
          <input className="adm-input" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} />
        </Field>
        <Field label="생년월일">
          <input type="date" className="adm-input" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </Field>
        <Field label="성별">
          <select className="adm-input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">미지정</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            {legacyGender && <option value={legacyGender}>{legacyGender}</option>}
          </select>
        </Field>
        <Field label="혈당 단위">
          <select className="adm-input" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            <option value="mg/dL">mg/dL</option>
            <option value="mmol">mmol/L</option>
            {legacyUnit && <option value={legacyUnit}>{legacyUnit}</option>}
          </select>
        </Field>
        <Field label="국가코드">
          <input className="adm-input" value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)} placeholder="예: KR" maxLength={100} />
        </Field>
        <Field label="언어">
          <input className="adm-input" value={form.language} onChange={(e) => set('language', e.target.value)} placeholder="예: ko" maxLength={100} />
        </Field>
      </form>
    </Modal>
  );
}
