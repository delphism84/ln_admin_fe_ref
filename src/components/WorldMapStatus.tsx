'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { adminFetch } from '@/lib/adminApi'
import { MAP_H, MAP_W, countryCoords, countryLabel, projectLngLat } from '@/lib/countryMeta'

export type WorldRegion = {
  countryCode: string
  users: number
  activeUsers: number
  devices: number
  dataPoints: number
}

type UserRow = {
  id: string
  email: string
  name: string
  provider: string
  countryCode: string
  createdAt: string
}

type Callout = {
  region: WorldRegion
  name: string
  x: number
  y: number
  elbowX: number
  elbowY: number
  badgeX: number
  badgeY: number
  side: 'left' | 'right'
}

const BADGE_W = 148
const BADGE_H = 72

function buildCallouts(regions: WorldRegion[]): Callout[] {
  const ranked = [...regions].sort((a, b) => b.users - a.users)
  const placed: Callout[] = []

  ranked.forEach((region, i) => {
    const { lat, lng } = countryCoords(region.countryCode)
    const { x, y } = projectLngLat(lng, lat)
    const preferRight = lng < 20 || (i % 2 === 0 && lng < 100)
    let side: 'left' | 'right' = preferRight ? 'right' : 'left'
    const diag = 36 + (i % 4) * 10
    const horiz = 54 + (i % 3) * 12
    const up = y > MAP_H * 0.55 ? -1 : 1

    let elbowX = side === 'right' ? x + diag * 0.7 : x - diag * 0.7
    let elbowY = y + up * diag * 0.55
    let badgeX = side === 'right' ? elbowX + horiz : elbowX - horiz - BADGE_W
    let badgeY = elbowY - BADGE_H / 2

    if (badgeX < 8) {
      side = 'right'
      elbowX = x + diag * 0.7
      badgeX = elbowX + horiz
    } else if (badgeX + BADGE_W > MAP_W - 8) {
      side = 'left'
      elbowX = x - diag * 0.7
      badgeX = elbowX - horiz - BADGE_W
    }
    badgeY = Math.max(8, Math.min(MAP_H - BADGE_H - 8, badgeY))
    elbowY = badgeY + BADGE_H / 2

    for (const prev of placed) {
      const overlapX = Math.abs(badgeX - prev.badgeX) < BADGE_W + 6
      const overlapY = Math.abs(badgeY - prev.badgeY) < BADGE_H + 6
      if (overlapX && overlapY) {
        badgeY = Math.min(MAP_H - BADGE_H - 8, prev.badgeY + BADGE_H + 10)
        elbowY = badgeY + BADGE_H / 2
      }
    }

    placed.push({
      region,
      name: countryLabel(region.countryCode),
      x,
      y,
      elbowX,
      elbowY,
      badgeX,
      badgeY,
      side
    })
  })

  return placed
}

export default function WorldMapStatus() {
  const [regions, setRegions] = useState<WorldRegion[]>([])
  const [totals, setTotals] = useState({ users: 0, activeUsers: 0, devices: 0, dataPoints: 0 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [mapSvg, setMapSvg] = useState('')
  const [modalCode, setModalCode] = useState<string | null>(null)
  const [modalRows, setModalRows] = useState<UserRow[]>([])
  const [modalTotal, setModalTotal] = useState(0)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalErr, setModalErr] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/maps/world.svg')
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return
        const styled = text.replace(
          /<svg\b([^>]*)>/i,
          '<svg$1 class="world-land-svg" style="width:100%;height:100%;display:block">'
        )
        setMapSvg(styled)
      })
      .catch(() => {
        if (!cancelled) setMapSvg('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/stats/world')
      if (res.status === 401) {
        setErr('인증이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
      if (!res.ok) {
        setErr(`전세계 현황을 불러오지 못했습니다 (${res.status})`)
        return
      }
      const data = await res.json()
      setRegions(Array.isArray(data.regions) ? data.regions : [])
      setTotals(
        data.totals || {
          users: 0,
          activeUsers: 0,
          devices: 0,
          dataPoints: 0
        }
      )
    } catch {
      setErr('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const callouts = useMemo(() => buildCallouts(regions), [regions])

  const openRegion = async (code: string) => {
    setModalCode(code)
    setModalRows([])
    setModalTotal(0)
    setModalErr('')
    setModalLoading(true)
    try {
      const res = await adminFetch(`/api/admin/stats/world/${encodeURIComponent(code)}/users?page=1&limit=100`)
      if (res.status === 401) {
        setModalErr('인증 만료')
        return
      }
      if (!res.ok) {
        setModalErr(`목록 조회 실패 (${res.status})`)
        return
      }
      const data = await res.json()
      setModalRows(Array.isArray(data.items) ? data.items : [])
      setModalTotal(typeof data.total === 'number' ? data.total : 0)
    } catch {
      setModalErr('네트워크 오류')
    } finally {
      setModalLoading(false)
    }
  }

  if (loading && regions.length === 0) {
    return (
      <div className='d-flex justify-content-center py-5'>
        <div className='spinner-border text-primary' role='status' />
      </div>
    )
  }

  return (
    <div>
      {err ? (
        <div className='alert alert-danger' role='alert'>
          {err}
        </div>
      ) : null}

      <div className='row g-3 mb-3'>
        <div className='col-6 col-md-3'>
          <div className='card border-0 shadow-sm h-100'>
            <div className='card-body py-3'>
              <div className='text-secondary small'>이용자</div>
              <div className='fs-4 fw-semibold'>{totals.users.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className='col-6 col-md-3'>
          <div className='card border-0 shadow-sm h-100'>
            <div className='card-body py-3'>
              <div className='text-secondary small'>활성 (7일)</div>
              <div className='fs-4 fw-semibold'>{totals.activeUsers.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className='col-6 col-md-3'>
          <div className='card border-0 shadow-sm h-100'>
            <div className='card-body py-3'>
              <div className='text-secondary small'>기기</div>
              <div className='fs-4 fw-semibold'>{totals.devices.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className='col-6 col-md-3'>
          <div className='card border-0 shadow-sm h-100'>
            <div className='card-body py-3'>
              <div className='text-secondary small'>혈당 건수</div>
              <div className='fs-4 fw-semibold'>{totals.dataPoints.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className='card border-0 shadow-sm'>
        <div className='card-body p-2 p-md-3'>
          {regions.length === 0 ? (
            <p className='text-secondary text-center py-5 mb-0'>표시할 국가별 데이터가 없습니다.</p>
          ) : (
            <div className='world-map-wrap position-relative w-100' style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
              <div
                className='world-map-inline position-absolute top-0 start-0 w-100 h-100'
                aria-hidden={true}
                dangerouslySetInnerHTML={mapSvg ? { __html: mapSvg } : undefined}
              />
              {!mapSvg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src='/maps/world.svg' alt='' className='position-absolute top-0 start-0 w-100 h-100' style={{ objectFit: 'fill', opacity: 0.85 }} />
              ) : null}

              <svg
                className='position-absolute top-0 start-0 w-100 h-100'
                viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                role='img'
                aria-label='전세계 현황 지도'
                style={{ pointerEvents: 'none' }}
              >
                {callouts.map((c) => {
                  const tipX = c.side === 'right' ? c.badgeX : c.badgeX + BADGE_W
                  return (
                    <g key={c.region.countryCode}>
                      <path
                        d={`M ${c.x} ${c.y} L ${c.elbowX} ${c.elbowY} L ${tipX} ${c.elbowY}`}
                        fill='none'
                        stroke='#1e3a2f'
                        strokeWidth={1.25}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        opacity={0.85}
                      />
                    </g>
                  )
                })}
              </svg>

              {callouts.map((c) => (
                <div key={`pin-${c.region.countryCode}`}>
                  <button
                    type='button'
                    aria-label={`${c.name} 위치`}
                    className='world-map-dot border-0 p-0'
                    style={{
                      position: 'absolute',
                      left: `${(c.x / MAP_W) * 100}%`,
                      top: `${(c.y / MAP_H) * 100}%`,
                      width: 3,
                      height: 3,
                      marginLeft: -1.5,
                      marginTop: -1.5,
                      borderRadius: '50%',
                      background: '#dc2626',
                      boxShadow: '0 0 0 1px #fff',
                      zIndex: 3,
                      cursor: 'pointer'
                    }}
                    onClick={() => void openRegion(c.region.countryCode)}
                  />
                  <button
                    type='button'
                    className='world-map-badge btn btn-light border shadow-sm text-start p-2'
                    style={{
                      position: 'absolute',
                      left: `${(c.badgeX / MAP_W) * 100}%`,
                      top: `${(c.badgeY / MAP_H) * 100}%`,
                      width: `${(BADGE_W / MAP_W) * 100}%`,
                      height: `${(BADGE_H / MAP_H) * 100}%`,
                      fontSize: '0.72rem',
                      lineHeight: 1.25,
                      zIndex: 2
                    }}
                    onClick={() => void openRegion(c.region.countryCode)}
                    title={`${c.name} 상세`}
                  >
                    <div className='fw-semibold text-truncate' style={{ fontSize: '0.78rem' }}>
                      {c.name}
                      <span className='text-secondary ms-1'>({c.region.countryCode})</span>
                    </div>
                    <div className='d-flex flex-wrap gap-1 mt-1'>
                      <span className='badge text-bg-secondary'>이용 {c.region.users}</span>
                      <span className='badge text-bg-success'>활성 {c.region.activeUsers}</span>
                      <span className='badge text-bg-primary'>기기 {c.region.devices}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className='small text-secondary mb-0 mt-2'>점·뱃지 클릭 시 해당 지역 이용자 목록을 표시합니다. 활성 = 최근 7일 혈당 데이터 있는 이용자.</p>
        </div>
      </div>

      {modalCode ? (
        <div className='modal d-block' tabIndex={-1} role='dialog' style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className='modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h2 className='modal-title h5'>
                  {countryLabel(modalCode)}
                  <span className='text-secondary ms-2 small'>({modalCode})</span>
                </h2>
                <button type='button' className='btn-close' aria-label='닫기' onClick={() => setModalCode(null)} />
              </div>
              <div className='modal-body'>
                {modalLoading ? (
                  <div className='text-center py-4'>
                    <div className='spinner-border spinner-border-sm text-primary' role='status' />
                  </div>
                ) : null}
                {modalErr ? (
                  <div className='alert alert-danger py-2' role='alert'>
                    {modalErr}
                  </div>
                ) : null}
                {!modalLoading && !modalErr ? (
                  <>
                    <p className='small text-secondary mb-2'>총 {modalTotal.toLocaleString()}명</p>
                    <div className='table-responsive'>
                      <table className='table table-sm table-hover align-middle mb-0'>
                        <thead>
                          <tr>
                            <th>이메일</th>
                            <th>이름</th>
                            <th>가입</th>
                            <th>가입일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalRows.length === 0 ? (
                            <tr>
                              <td colSpan={4} className='text-secondary text-center py-4'>
                                이용자가 없습니다.
                              </td>
                            </tr>
                          ) : (
                            modalRows.map((r) => (
                              <tr key={r.id}>
                                <td>{r.email}</td>
                                <td>{r.name}</td>
                                <td>{r.provider}</td>
                                <td>{r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </div>
              <div className='modal-footer'>
                <button type='button' className='btn btn-secondary btn-sm' onClick={() => setModalCode(null)}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
