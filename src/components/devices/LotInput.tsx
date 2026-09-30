'use client';

import { useId } from 'react';

/** 로트 코드 입력: 자유 입력 + 기존 로트 자동 완성. 코드는 서버와 같이 대문자로 맞춘다. */
export default function LotInput({
  value, onChange, lots, placeholder = '로트 코드(선택)',
}: { value: string; onChange: (v: string) => void; lots: string[]; placeholder?: string }) {
  const listId = useId();
  return (
    <>
      <input className="adm-input" list={listId} value={value} maxLength={40} placeholder={placeholder} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <datalist id={listId}>
        {lots.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
    </>
  );
}
