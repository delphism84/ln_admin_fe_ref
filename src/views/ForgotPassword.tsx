'use client'

import type { Mode } from '@core/types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Link from 'next/link'

export default function ForgotPassword(_props: { mode: Mode }) {
  return (
    <Box className='flex flex-col items-center justify-center gap-4 p-8'>
      <Typography variant='h6'>비밀번호 찾기</Typography>
      <Typography color='text.secondary' variant='body2'>
        관리자에게 문의하세요.
      </Typography>
      <Button component={Link} href='/login' variant='outlined'>
        로그인으로
      </Button>
    </Box>
  )
}
