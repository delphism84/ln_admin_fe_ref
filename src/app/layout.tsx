import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'bootstrap/dist/css/bootstrap.min.css'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'ZENITHPARK API Admin (Office)',
  description: 'Niuniu seamless API admin console'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='ko' className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-[#f4f6fb] text-slate-900 antialiased`}>{children}</body>
    </html>
  )
}
