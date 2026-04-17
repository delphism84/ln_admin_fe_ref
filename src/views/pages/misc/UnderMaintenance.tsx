'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Link from 'next/link'

export default function UnderMaintenance() {
  return (
    <Box className='flex flex-col items-center justify-center gap-4 p-8'>
      <Typography variant='h5'>점검 중</Typography>
      <Typography color='text.secondary'>잠시 후 다시 시도해 주세요.</Typography>
      <Button component={Link} href='/niuniu' variant='contained'>
        Admin Console
      </Button>
    </Box>
  )
}
