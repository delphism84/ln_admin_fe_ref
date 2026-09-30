'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { adminFetch } from '@/lib/adminApi'

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b']

type DeviceLive = {
  eqsn: string
  userEmail: string
  userLabel: string
  activityPct: number
  avgIntervalSec: number | null
  points24h: number
  lastAt: string | null
}

type RecentAlarm = {
  time: string
  eqsn: string
  userEmail: string
  userLabel: string
  type: string
  threshold: number
  value: number
  unit: string
}

type Stats = {
  totals: { users: number; devices: number; dataPoints: number }
  lineUsers: { day: string; count: number }[]
  barGlucose: { day: string; count: number }[]
  pieDevices: { name: string; value: number }[]
  devicesLive?: DeviceLive[]
  devicesLiveSummary?: { count: number; avgActivityPct: number; avgIntervalSec: number | null }
  recentAlarms?: RecentAlarm[]
}

const ALARM_TYPE_LABEL: Record<string, string> = {
  very_low: '매우 낮음',
  low: '낮음',
  high: '높음',
  rate: '급변',
  system: '시스템'
}

function formatInterval(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—'
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m <= 0) return `${s}초`
  return `${m}분 ${s}초`
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/stats')
      if (res.status === 401) {
        setErr('인증이 만료되었습니다. 다시 로그인해 주세요.')
        setStats(null)
        return
      }
      if (!res.ok) {
        setErr(`통계를 불러오지 못했습니다 (${res.status})`)
        setStats(null)
        return
      }
      setStats((await res.json()) as Stats)
    } catch {
      setErr('네트워크 오류')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !stats) {
    return (
      <div className='d-flex justify-content-center py-5'>
        <div className='spinner-border text-primary' role='status' />
      </div>
    )
  }

  const devicesLive = stats?.devicesLive || []
  const summary = stats?.devicesLiveSummary
  const recentAlarms = stats?.recentAlarms || []

  return (
    <div>
      <h1 className='h4 fw-semibold mb-4'>전체 현황</h1>
      {err ? (
        <div className='alert alert-danger' role='alert'>
          {err}
        </div>
      ) : null}
      {stats ? (
        <>
          <div className='row g-3 mb-4'>
            <div className='col-md-4'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-body'>
                  <div className='text-secondary small'>총 회원</div>
                  <div className='fs-3 fw-semibold'>{stats.totals.users.toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className='col-md-4'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-body'>
                  <div className='text-secondary small'>총 등록 기기</div>
                  <div className='fs-3 fw-semibold'>{stats.totals.devices.toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className='col-md-4'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-body'>
                  <div className='text-secondary small'>총 데이터 건수</div>
                  <div className='fs-3 fw-semibold'>{stats.totals.dataPoints.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          <div className='row g-3 mb-4'>
            <div className='col-md-4'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-body'>
                  <div className='text-secondary small'>평균 데이터 활성 (1일)</div>
                  <div className='fs-3 fw-semibold'>{summary ? `${summary.avgActivityPct}%` : '—'}</div>
                  <div className='small text-secondary mt-1'>최근 24시간 · 분 단위 수집 비율</div>
                </div>
              </div>
            </div>
            <div className='col-md-4'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-body'>
                  <div className='text-secondary small'>평균 수집 간격</div>
                  <div className='fs-3 fw-semibold'>{formatInterval(summary?.avgIntervalSec)}</div>
                  <div className='small text-secondary mt-1'>기기별 연속 포인트 간격 평균</div>
                </div>
              </div>
            </div>
            <div className='col-md-4'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-body'>
                  <div className='text-secondary small'>24시간 활성 기기</div>
                  <div className='fs-3 fw-semibold'>{summary?.count ?? 0}</div>
                  <div className='small text-secondary mt-1'>혈당 데이터가 있는 기기 수</div>
                </div>
              </div>
            </div>
          </div>

          <div className='row g-3 mb-4'>
            <div className='col-lg-6'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-header bg-white border-0 py-3 fw-medium'>기기별 데이터 활성 · 수집 간격</div>
                <div className='card-body pt-0'>
                  <div className='table-responsive' style={{ maxHeight: 320 }}>
                    <table className='table table-sm table-hover align-middle mb-0'>
                      <thead className='table-light sticky-top'>
                        <tr>
                          <th>기기</th>
                          <th>사용자</th>
                          <th>활성(1일)</th>
                          <th>평균 간격</th>
                          <th>건수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devicesLive.length === 0 ? (
                          <tr>
                            <td colSpan={5} className='text-secondary text-center py-4'>
                              최근 24시간 데이터가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          devicesLive.map((d) => (
                            <tr key={d.eqsn}>
                              <td className='font-monospace small'>{d.eqsn}</td>
                              <td>
                                <div className='small fw-medium'>{d.userLabel}</div>
                                <div className='text-secondary' style={{ fontSize: '0.75rem' }}>
                                  {d.userEmail}
                                </div>
                              </td>
                              <td>
                                <span className='fw-semibold'>{d.activityPct}%</span>
                                <div className='progress mt-1' style={{ height: 4 }}>
                                  <div
                                    className='progress-bar bg-success'
                                    role='progressbar'
                                    style={{ width: `${Math.min(100, d.activityPct)}%` }}
                                  />
                                </div>
                              </td>
                              <td>{formatInterval(d.avgIntervalSec)}</td>
                              <td>{d.points24h.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-lg-6'>
              <div className='card border-0 shadow-sm h-100'>
                <div className='card-header bg-white border-0 py-3 fw-medium'>최근 알람</div>
                <div className='card-body pt-0'>
                  <div className='table-responsive' style={{ maxHeight: 320 }}>
                    <table className='table table-sm table-hover align-middle mb-0'>
                      <thead className='table-light sticky-top'>
                        <tr>
                          <th>시각</th>
                          <th>기기</th>
                          <th>사용자</th>
                          <th>기준</th>
                          <th>수치</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAlarms.length === 0 ? (
                          <tr>
                            <td colSpan={5} className='text-secondary text-center py-4'>
                              최근 24시간 임계 알람이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          recentAlarms.map((a, i) => (
                            <tr key={`${a.eqsn}-${a.time}-${i}`}>
                              <td className='small'>{a.time ? new Date(a.time).toLocaleString('ko-KR') : '—'}</td>
                              <td className='font-monospace small'>{a.eqsn}</td>
                              <td>
                                <div className='small fw-medium'>{a.userLabel}</div>
                                <div className='text-secondary' style={{ fontSize: '0.75rem' }}>
                                  {a.userEmail}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    a.type === 'high' ? 'text-bg-warning' : a.type === 'very_low' ? 'text-bg-danger' : 'text-bg-secondary'
                                  }`}
                                >
                                  {ALARM_TYPE_LABEL[a.type] || a.type}
                                </span>
                                <div className='text-secondary' style={{ fontSize: '0.72rem' }}>
                                  기준 {a.threshold} {a.unit}
                                </div>
                              </td>
                              <td className='fw-semibold'>
                                {a.value} <span className='text-secondary fw-normal small'>{a.unit}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className='small text-secondary mb-0 mt-2'>사용자 알람 설정(없으면 기본: 매우낮음≤54 / 낮음≤70 / 높음≥180) 기준의 최근 혈당 임계 이벤트입니다.</p>
                </div>
              </div>
            </div>
          </div>

          <div className='row g-3 mb-3'>
            <div className='col-lg-6'>
              <div className='card border-0 shadow-sm'>
                <div className='card-header bg-white border-0 py-3 fw-medium'>일별 신규 회원 (최근 14일)</div>
                <div className='card-body' style={{ height: 300 }}>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={stats.lineUsers} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='day' tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type='monotone' dataKey='count' stroke='#6366f1' strokeWidth={2} dot={false} name='명' />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className='col-lg-6'>
              <div className='card border-0 shadow-sm'>
                <div className='card-header bg-white border-0 py-3 fw-medium'>일별 혈당 포인트 (최근 14일)</div>
                <div className='card-body' style={{ height: 300 }}>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={stats.barGlucose} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='day' tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey='count' fill='#10b981' name='건' radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          <div className='row g-3'>
            <div className='col-lg-6'>
              <div className='card border-0 shadow-sm'>
                <div className='card-header bg-white border-0 py-3 fw-medium'>사용자당 등록 기기 분포</div>
                <div className='card-body' style={{ height: 320 }}>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={stats.pieDevices}
                        dataKey='value'
                        nameKey='name'
                        cx='50%'
                        cy='50%'
                        outerRadius={100}
                        label={({ name, value }) => (name != null && value != null ? `${name}: ${value}` : '')}
                      >
                        {stats.pieDevices.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
