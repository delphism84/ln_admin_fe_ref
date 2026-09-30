'use client'

import { useState } from 'react'

import { adminFetch } from '@/lib/adminApi'

type SettingsTab = 'system'

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('system')
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const openModal = () => {
    setPassword('')
    setErr('')
    setMsg('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (busy) return
    setModalOpen(false)
    setPassword('')
    setErr('')
  }

  const runReset = async () => {
    setErr('')
    setMsg('')
    if (!password) {
      setErr('관리자 비밀번호를 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const res = await adminFetch('/api/admin/system/reset', {
        method: 'POST',
        body: JSON.stringify({ password })
      })
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}))
        setErr(data?.error === 'invalid_password' ? '비밀번호가 올바르지 않습니다.' : '인증이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
      if (!res.ok) {
        setErr(`초기화 실패 (${res.status})`)
        return
      }
      const data = await res.json()
      setModalOpen(false)
      setPassword('')
      const d = data?.deleted
      setMsg(
        d
          ? `시스템 초기화가 완료되었습니다. (사용자 ${d.users} · 기기 ${d.devices} · 혈당 ${d.glucose} · 이벤트 ${d.events})`
          : '시스템 초기화가 완료되었습니다.'
      )
    } catch {
      setErr('네트워크 오류')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className='h4 mb-3'>설정</h1>

      <ul className='nav nav-tabs mb-3'>
        <li className='nav-item'>
          <button
            type='button'
            className={`nav-link ${tab === 'system' ? 'active' : ''}`}
            onClick={() => setTab('system')}
          >
            시스템
          </button>
        </li>
      </ul>

      {msg ? (
        <div className='alert alert-success py-2' role='alert'>
          {msg}
        </div>
      ) : null}

      {tab === 'system' ? (
        <div className='card'>
          <div className='card-header fw-semibold'>시스템 관리</div>
          <div className='card-body'>
            <p className='text-secondary small mb-3'>
              모든 사용자·기기·혈당·이벤트·센서·알람·앱설정을 삭제하고 기본 시드 계정만 다시 생성합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <button type='button' className='btn btn-danger' onClick={openModal}>
              초기화
            </button>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className='modal d-block' tabIndex={-1} role='dialog' style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className='modal-dialog modal-dialog-centered'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h2 className='modal-title h5 text-danger'>시스템 초기화</h2>
                <button type='button' className='btn-close' aria-label='닫기' disabled={busy} onClick={closeModal} />
              </div>
              <div className='modal-body'>
                <p className='mb-3'>
                  모든 데이터를 초기화하시겠습니까?
                  <br />
                  <span className='text-danger small'>삭제된 데이터는 복구할 수 없습니다.</span>
                </p>
                {err ? (
                  <div className='alert alert-danger py-2' role='alert'>
                    {err}
                  </div>
                ) : null}
                <label className='form-label' htmlFor='system-reset-password'>
                  관리자 비밀번호
                </label>
                <input
                  id='system-reset-password'
                  type='password'
                  className='form-control'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete='current-password'
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runReset()
                  }}
                />
              </div>
              <div className='modal-footer'>
                <button type='button' className='btn btn-secondary btn-sm' disabled={busy} onClick={closeModal}>
                  취소
                </button>
                <button type='button' className='btn btn-danger btn-sm' disabled={busy || !password} onClick={() => void runReset()}>
                  {busy ? '초기화 중…' : '초기화'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
