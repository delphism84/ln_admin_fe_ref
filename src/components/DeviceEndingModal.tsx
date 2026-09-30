'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { adminFetch } from '@/lib/adminApi'

export type EndingDevice = {
  id: string
  serial: string
  bleMac: string
  startAt: string
  endAt: string
  remainingMs: number
  remainingSec: number
  userId: string | null
  userEmail: string
  userLabel: string
  userProvider?: string
  userCountryCode?: string
  userUnit?: string
  userCreatedAt?: string | null
}

type DeviceDetail = {
  id: string
  serial: string
  bleMac: string
  startAt: string | null
  endAt: string | null
  remainingMs: number | null
  remainingSec: number | null
  validityDays: number
  user: {
    id: string
    email: string
    name: string
    firstName: string
    lastName: string
    provider: string
    countryCode: string
    unit: string
    language: string
    dateOfBirth: string
    gender: string
    createdAt?: string
    updatedAt?: string
  } | null
}

type Props = {
  device: EndingDevice | null
  open: boolean
  onClose: () => void
}

function formatRemain(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}시간 ${m}분 ${s}초`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

export default function DeviceEndingModal({ device, open, onClose }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<DeviceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open || !device?.id) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr('')
    void (async () => {
      try {
        const res = await adminFetch(`/api/admin/devices/${device.id}`)
        if (cancelled) return
        if (res.status === 401) {
          setErr('인증 만료')
          return
        }
        if (!res.ok) {
          setErr(`상세 조회 실패 (${res.status})`)
          return
        }
        setDetail((await res.json()) as DeviceDetail)
      } catch {
        if (!cancelled) setErr('네트워크 오류')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, device?.id])

  if (!open || !device) return null

  const remainSec = detail?.remainingSec ?? device.remainingSec
  const user = detail?.user
  const userEmail = user?.email || device.userEmail
  const userLabel = user?.name || device.userLabel

  const goUserDetail = () => {
    const q = new URLSearchParams()
    if (userEmail && userEmail !== '—') q.set('user', userEmail)
    else if (userLabel && userLabel !== '—') q.set('user', userLabel)
    onClose()
    router.push(`/users?${q.toString()}`)
  }

  return (
    <div className='modal d-block' tabIndex={-1} role='dialog' style={{ background: 'rgba(0,0,0,.45)' }}>
      <div className='modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h2 className='modal-title h5'>종료 예정 기기</h2>
            <button type='button' className='btn-close' aria-label='닫기' onClick={onClose} />
          </div>
          <div className='modal-body'>
            {loading ? <p className='text-secondary mb-3'>불러오는 중…</p> : null}
            {err ? (
              <div className='alert alert-danger py-2' role='alert'>
                {err}
              </div>
            ) : null}

            <h3 className='h6 text-secondary'>기기 정보</h3>
            <div className='row g-2 mb-4'>
              <div className='col-md-6'>
                <div className='small text-secondary'>S/N</div>
                <div className='fw-semibold font-monospace'>{detail?.serial || device.serial}</div>
              </div>
              <div className='col-md-6'>
                <div className='small text-secondary'>MAC</div>
                <div className='font-monospace small'>{detail?.bleMac || device.bleMac || '—'}</div>
              </div>
              <div className='col-md-6'>
                <div className='small text-secondary'>시작</div>
                <div>{(detail?.startAt || device.startAt) ? new Date(detail?.startAt || device.startAt).toLocaleString('ko-KR') : '—'}</div>
              </div>
              <div className='col-md-6'>
                <div className='small text-secondary'>종료 예정</div>
                <div>{(detail?.endAt || device.endAt) ? new Date(detail?.endAt || device.endAt).toLocaleString('ko-KR') : '—'}</div>
              </div>
              <div className='col-md-6'>
                <div className='small text-secondary'>잔여 시간</div>
                <div className='fs-5 fw-semibold text-danger'>{formatRemain(remainSec)}</div>
              </div>
              <div className='col-md-6'>
                <div className='small text-secondary'>유효 기간</div>
                <div>{detail?.validityDays ?? 15}일</div>
              </div>
            </div>

            <h3 className='h6 text-secondary'>사용자 정보</h3>
            <div className='row g-2'>
              <div className='col-md-6'>
                <div className='small text-secondary'>이름</div>
                <div className='fw-semibold'>{userLabel || '—'}</div>
              </div>
              <div className='col-md-6'>
                <div className='small text-secondary'>이메일</div>
                <div>{userEmail || '—'}</div>
              </div>
              <div className='col-md-4'>
                <div className='small text-secondary'>가입 경로</div>
                <div>{user?.provider || device.userProvider || 'local'}</div>
              </div>
              <div className='col-md-4'>
                <div className='small text-secondary'>국가</div>
                <div>{user?.countryCode || device.userCountryCode || '—'}</div>
              </div>
              <div className='col-md-4'>
                <div className='small text-secondary'>단위</div>
                <div>{user?.unit || device.userUnit || '—'}</div>
              </div>
              {user?.dateOfBirth ? (
                <div className='col-md-4'>
                  <div className='small text-secondary'>생년월일</div>
                  <div>{String(user.dateOfBirth).slice(0, 10)}</div>
                </div>
              ) : null}
              {user?.gender ? (
                <div className='col-md-4'>
                  <div className='small text-secondary'>성별</div>
                  <div>{user.gender}</div>
                </div>
              ) : null}
              {user?.createdAt ? (
                <div className='col-md-4'>
                  <div className='small text-secondary'>가입일</div>
                  <div className='small'>{new Date(user.createdAt).toLocaleString('ko-KR')}</div>
                </div>
              ) : null}
            </div>
          </div>
          <div className='modal-footer'>
            <button type='button' className='btn btn-secondary btn-sm' onClick={onClose}>
              닫기
            </button>
            <button
              type='button'
              className='btn btn-primary btn-sm'
              disabled={!userEmail || userEmail === '—'}
              onClick={goUserDetail}
            >
              사용자 자세히 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
