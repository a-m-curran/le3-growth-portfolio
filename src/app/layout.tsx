import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Suspense } from 'react'
import { Header } from '@/components/ui/Header'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'LE3 Growth Portfolio',
  description: 'Growth conversations and skill development tracking for LE3 students',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased min-h-screen`}>
        <Suspense>
          <Header />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
