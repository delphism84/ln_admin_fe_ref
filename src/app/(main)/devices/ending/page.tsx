'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import DeviceEndingModal, { type EndingDevice } from '@/components/DeviceEndingModal'
import { ADMIN_TOKEN_KEY, adminFetch, getAdminToken } from '@/lib/adminApi'

function formatRemain(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}시간 ${m}분 ${s}초`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

function wsUrl(): string {
  if (typeof window === 'undefined') return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = getAdminToken() || (typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : '') || ''
  return `${proto}//${window.location.host}/api/admin/ws/devices-ending?token=${encodeURIComponent(token)}`
}

export default function DevicesEndingPage() {
  const [items, setItems] = useState<EndingDevice[]>([])
  const [err, setErr] = useState('')
  const [wsState, setWsState] = useState<'connecting' | 'live' | 'fallback' | 'off'>('connecting')
  const [selected, setSelected] = useState<EndingDevice | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyList = useCallback((list: EndingDevice[]) => {
    const sorted = [...list].sort((a, b) => a.remainingMs - b.remainingMs)
    setItems(sorted)
  }, [])

  const fetchOnce = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/devices/ending-soon')
      if (res.status === 401) {
        setErr('인증이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
      if (!res.ok) {
        setErr(`조회 실패 (${res.status})`)
        return
      }
      const data = await res.json()
      applyList(Array.isArray(data.items) ? data.items : [])
      setErr('')
    } catch {
      setErr('네트워크 오류')
    }
  }, [applyList])

  const startPoll = useCallback(() => {
    if (pollRef.current) return
    setWsState('fallback')
    void fetchOnce()
    pollRef.current = setInterval(() => void fetchOnce(), 1000)
  }, [fetchOnce])

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    let closed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (closed) return
      setWsState('connecting')
      try {
        const url = wsUrl()
        const ws = new WebSocket(url)
        wsRef.current = ws
        ws.onopen = () => {
          if (closed) return
          stopPoll()
          setWsState('live')
          setErr('')
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'devices_ending_soon' && Array.isArray(msg.items)) {
              applyList(msg.items)
            }
          } catch (_) {}
        }
        ws.onerror = () => {
          // onclose에서 fallback 처리
        }
        ws.onclose = () => {
          wsRef.current = null
          if (closed) return
          startPoll()
          retryTimer = setTimeout(connect, 5000)
        }
      } catch {
        startPoll()
        retryTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      stopPoll()
      try {
        wsRef.current?.close()
      } catch (_) {}
      wsRef.current = null
    }
  }, [applyList, startPoll, stopPoll])

  const openModal = (row: EndingDevice) => {
    setSelected(row)
    setModalOpen(true)
  }

  return (
    <div>
      <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3'>
        <h1 className='h4 fw-semibold mb-0'>종료 예정 기기</h1>
        <span
          className={`badge ${
            wsState === 'live' ? 'text-bg-success' : wsState === 'fallback' ? 'text-bg-warning' : 'text-bg-secondary'
          }`}
        >
          {wsState === 'live' ? '실시간 (WSS)' : wsState === 'fallback' ? '폴링 대체' : '연결 중…'}
        </span>
      </div>
      <p className='small text-secondary mb-3'>
        센서 유효기간(15일) 기준 종료까지 1일 이내인 기기입니다. 잔여 시간이 짧은 순으로 정렬되며 실시간 갱신됩니다.
      </p>
      {err ? (
        <div className='alert alert-danger py-2' role='alert'>
          {err}
        </div>
      ) : null}

      <div className='admin-console-grid'>
        <div className='table-responsive'>
          <table className='table table-hover table-sm mb-0'>
            <thead className='table-light'>
              <tr>
                <th>잔여 시간</th>
                <th>S/N</th>
                <th>MAC</th>
                <th>사용자</th>
                <th>이메일</th>
                <th>종료 예정</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className='text-secondary text-center py-4'>
                    1일 이내 종료 예정 기기가 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    role='button'
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openModal(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openModal(r)
                      }
                    }}
                  >
                    <td className='text-nowrap fw-semibold text-danger'>{formatRemain(r.remainingSec)}</td>
                    <td className='text-nowrap font-monospace'>{r.serial}</td>
                    <td className='text-nowrap font-monospace small'>{r.bleMac || '—'}</td>
                    <td>{r.userLabel}</td>
                    <td>{r.userEmail}</td>
                    <td className='text-nowrap small'>{r.endAt ? new Date(r.endAt).toLocaleString('ko-KR') : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className='small text-secondary mt-2 mb-0'>총 {items.length.toLocaleString()}대 · 행 클릭 시 기기·사용자 상세</p>

      <DeviceEndingModal
        device={selected}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelected(null)
        }}
      />
    </div>
  )
}
