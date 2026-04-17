'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

type AgentItem = {
  id: string
  username?: string
  nickname?: string
  type?: string
  grade?: string
  callbackUrl?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.kingofzeusfin.com'

const MENU = ['에이전트 관리', '회원 관리', '게임 로그 관리', 'API 사용 관리', 'API Reference'] as const

type MenuKey = (typeof MENU)[number]

const AdminHomePage = () => {
  const router = useRouter()
  const [activeMenu, setActiveMenu] = useState<MenuKey>('에이전트 관리')
  const [token, setToken] = useState('')
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [agentList, setAgentList] = useState<AgentItem[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')
  const [statusText, setStatusText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [generatedToken, setGeneratedToken] = useState('')

  const selectedAgent = useMemo(
    () => agentList.find(agent => (agent.id || '') === selectedAgentId),
    [agentList, selectedAgentId]
  )

  useEffect(() => {
    const savedToken = localStorage.getItem('zp_admin_jwt') || ''

    if (!savedToken) {
      router.replace('/login')

      return
    }

    setToken(savedToken)
  }, [router])

  useEffect(() => {
    if (!token) return

    const fetchAgents = async () => {
      setLoadingAgents(true)
      setErrorText('')

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/sub-agents`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          if (res.status === 401) throw new Error('토큰이 만료되었거나 권한이 없습니다. 다시 로그인해주세요.')
          throw new Error(data?.message || `에이전트 조회 실패 (HTTP ${res.status})`)
        }

        const items: AgentItem[] = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : Array.isArray(data?.agents)
              ? data.agents
              : []

        setAgentList(items)

        if (items.length > 0) {
          setSelectedAgentId(items[0].id || '')
          setCallbackUrl(items[0].callbackUrl || '')
        }
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : '에이전트 조회 중 오류가 발생했습니다.')
      } finally {
        setLoadingAgents(false)
      }
    }

    fetchAgents()
  }, [token])

  useEffect(() => {
    setCallbackUrl(selectedAgent?.callbackUrl || '')
  }, [selectedAgent])

  const logout = () => {
    localStorage.removeItem('zp_admin_jwt')
    router.push('/login')
  }

  const saveCallbackUrl = async () => {
    if (!selectedAgentId) return

    setStatusText('')
    setErrorText('')

    try {
      const res = await fetch(`${API_BASE_URL}/api/agent/update-callback-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          agentId: selectedAgentId,
          callbackUrl
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data?.message || `Callback URL 저장 실패 (HTTP ${res.status})`)

      setStatusText('Callback URL이 저장되었습니다.')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Callback URL 저장 중 오류가 발생했습니다.')
    }
  }

  const generateToken = async () => {
    if (!selectedAgentId) return

    setStatusText('')
    setErrorText('')
    setGeneratedToken('')

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ agentId: selectedAgentId })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data?.message || `토큰 발급 실패 (HTTP ${res.status})`)

      const newToken = data?.token || data?.data?.token || data?.apiKey || ''

      if (!newToken) throw new Error('응답에 토큰 값이 없습니다.')

      setGeneratedToken(newToken)
      setStatusText('에이전트 API 토큰이 발급되었습니다.')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '토큰 발급 중 오류가 발생했습니다.')
    }
  }

  const openSwagger = () => {
    window.open(`${API_BASE_URL}/swagger`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 4 }, bgcolor: 'background.default' }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper variant='outlined' sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction='row' alignItems='center' justifyContent='space-between' flexWrap='wrap' gap={2}>
              <Stack direction='row' spacing={1.5} alignItems='center'>
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                  <i className='ri-shield-user-line' />
                </Avatar>
                <Box>
                  <Typography variant='h5'>Niuniu API Admin</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Agent Callback URL / API Token 운영 콘솔
                  </Typography>
                </Box>
              </Stack>
              <Button variant='outlined' color='error' onClick={logout}>
                로그아웃
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant='subtitle2' color='text.secondary' sx={{ px: 1.5, py: 1 }}>
                ADMIN MENU
              </Typography>
              <List dense disablePadding>
                {MENU.map(menu => (
                  <ListItemButton
                    key={menu}
                    selected={activeMenu === menu}
                    onClick={() => setActiveMenu(menu)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemText primary={menu} />
                  </ListItemButton>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={9}>
          <Card sx={{ borderRadius: 3, minHeight: 520 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                {statusText && <Alert severity='success'>{statusText}</Alert>}
                {errorText && <Alert severity='error'>{errorText}</Alert>}

                {activeMenu === '에이전트 관리' && (
                  <>
                    <Typography variant='h6'>에이전트 관리</Typography>
                    <Divider />

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Card variant='outlined' sx={{ borderRadius: 2 }}>
                          <CardContent>
                            <Stack spacing={2}>
                              <Typography variant='subtitle1'>에이전트 선택</Typography>
                              {loadingAgents ? (
                                <Stack direction='row' spacing={1.5} alignItems='center'>
                                  <CircularProgress size={18} />
                                  <Typography variant='body2'>에이전트 목록 불러오는 중...</Typography>
                                </Stack>
                              ) : (
                                <TextField
                                  select
                                  fullWidth
                                  label='에이전트'
                                  SelectProps={{ native: true }}
                                  value={selectedAgentId}
                                  onChange={e => setSelectedAgentId(e.target.value)}
                                >
                                  <option value=''>선택하세요</option>
                                  {agentList.map(agent => (
                                    <option key={agent.id} value={agent.id}>
                                      {(agent.nickname || agent.username || agent.id) as string}
                                    </option>
                                  ))}
                                </TextField>
                              )}

                              {selectedAgent && (
                                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                                  <Chip size='small' label={`ID: ${selectedAgent.id}`} />
                                  <Chip size='small' color='primary' variant='outlined' label={`Type: ${selectedAgent.type || '-'}`} />
                                  <Chip size='small' color='secondary' variant='outlined' label={`Grade: ${selectedAgent.grade || '-'}`} />
                                </Stack>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Card variant='outlined' sx={{ borderRadius: 2 }}>
                          <CardContent>
                            <Stack spacing={2}>
                              <Typography variant='subtitle1'>콜백 / 토큰 관리</Typography>
                              <TextField
                                fullWidth
                                label='Callback URL'
                                value={callbackUrl}
                                onChange={e => setCallbackUrl(e.target.value)}
                                placeholder='https://...'
                                disabled={!selectedAgentId}
                              />
                              <Stack direction='row' spacing={1.5}>
                                <Button variant='contained' onClick={saveCallbackUrl} disabled={!selectedAgentId}>
                                  Callback 저장
                                </Button>
                                <Button variant='outlined' onClick={generateToken} disabled={!selectedAgentId}>
                                  토큰 발급
                                </Button>
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {generatedToken && (
                      <Card variant='outlined' sx={{ borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                            발급된 API 토큰
                          </Typography>
                          <TextField fullWidth multiline minRows={3} value={generatedToken} />
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {activeMenu !== '에이전트 관리' && activeMenu !== 'API Reference' && (
                  <>
                    <Typography variant='h6'>{activeMenu}</Typography>
                    <Divider />
                    <Paper variant='outlined' sx={{ p: 3, borderRadius: 2 }}>
                      <Typography color='text.secondary'>다음 단계에서 테이블/필터/페이징 UI와 API를 연결합니다.</Typography>
                    </Paper>
                  </>
                )}

                {activeMenu === 'API Reference' && (
                  <>
                    <Typography variant='h6'>API Reference</Typography>
                    <Divider />
                    <Paper variant='outlined' sx={{ p: 3, borderRadius: 2 }}>
                      <Stack direction='row' alignItems='center' justifyContent='space-between' flexWrap='wrap' gap={1.5}>
                        <Typography color='text.secondary'>Swagger 문서로 이동해 엔드포인트를 확인할 수 있습니다.</Typography>
                        <Button variant='contained' onClick={openSwagger}>
                          Swagger 열기
                        </Button>
                      </Stack>
                    </Paper>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default AdminHomePage
