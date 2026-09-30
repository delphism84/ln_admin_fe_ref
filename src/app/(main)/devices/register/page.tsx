'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PageTitle } from '@/components/ui/adm';
import SingleRegisterForm from '@/components/devices/SingleRegisterForm';
import RangeGenerateForm from '@/components/devices/RangeGenerateForm';
import CsvImportForm from '@/components/devices/CsvImportForm';
import { useLots } from '@/components/devices/hooks';

const TABS = [
  { id: 'single', label: '단건 등록' },
  { id: 'range', label: '범위 생성' },
  { id: 'csv', label: 'CSV 가져오기' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function DeviceRegisterPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<TabId>('single');
  const { lots } = useLots();
  const lotCodes = useMemo(() => lots.map((l) => l.code), [lots]);

  return (
    <div>
      <PageTitle
        title="SN 등록·가져오기"
        desc="회사가 만든 센서의 SN 을 재고(SN 대장)에 올립니다. 재고에 있는 SN 만 “확인됨”으로 표시됩니다."
        right={
          <Link href="/devices" prefetch={false} className="adm-btn">
            <ArrowLeft size={15} /> 기기 목록
          </Link>
        }
      />

      {can('devices.write') ? (
        <>
          <div role="tablist" aria-label="등록 방법" className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`register-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="register-tabpanel"
                className={`adm-btn ${tab === t.id ? 'adm-btn-primary' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* 탭을 오가도 입력(붙여 넣은 CSV 등)이 남도록 셋 다 그려 두고 숨긴다. */}
          <div role="tabpanel" id="register-tabpanel" aria-labelledby={`register-tab-${tab}`}>
            <div hidden={tab !== 'single'}>
              <SingleRegisterForm lots={lotCodes} />
            </div>
            <div hidden={tab !== 'range'}>
              <RangeGenerateForm lots={lotCodes} />
            </div>
            <div hidden={tab !== 'csv'}>
              <CsvImportForm lots={lotCodes} />
            </div>
          </div>
        </>
      ) : (
        <div className="adm-card p-10 text-center text-base-content/65">SN 을 등록할 권한이 없습니다.</div>
      )}
    </div>
  );
}
