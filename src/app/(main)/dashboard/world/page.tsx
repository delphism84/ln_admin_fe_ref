'use client'

import WorldMapStatus from '@/components/WorldMapStatus'

export default function WorldDashboardPage() {
  return (
    <div>
      <h1 className='h4 fw-semibold mb-4'>전세계 현황</h1>
      <WorldMapStatus />
    </div>
  )
}
