import { Suspense } from 'react'
import { DemoHeader } from '@/components/ui/DemoHeader'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <DemoHeader />
      </Suspense>
      {children}
    </>
  )
}
