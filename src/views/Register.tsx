'use client'

import type { Mode } from '@core/types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Link from 'next/link'

export default function Register(_props: { mode: Mode }) {
  return (
    <Box className='flex flex-col items-center justify-center gap-4 p-8'>
      <Typography variant='h6'>회원가입</Typography>
      <Typography color='text.secondary' variant='body2'>
        이 환경에서는 등록 기능을 사용하지 않습니다.
      </Typography>
      <Button component={Link} href='/login' variant='contained'>
        로그인으로
      </Button>
    </Box>
  )
}
