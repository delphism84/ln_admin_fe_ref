'use client'

import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Link from 'next/link'

export default function NotFound() {
  return (
    <Box className='flex flex-col items-center justify-center gap-4 p-8'>
      <Typography variant='h4'>404</Typography>
      <Typography color='text.secondary'>페이지를 찾을 수 없습니다.</Typography>
      <Button component={Link} href='/niuniu' variant='contained'>
        Admin Console
      </Button>
    </Box>
  )
}
