'use client'

import { Suspense } from 'react'

import UsersPageClient from './UsersPageClient'

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className='d-flex justify-content-center py-5'>
          <div className='spinner-border text-primary' role='status' />
        </div>
      }
    >
      <UsersPageClient />
    </Suspense>
  )
}
