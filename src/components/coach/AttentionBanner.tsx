'use client'

import type { AttentionItem } from '@/lib/types'

interface AttentionBannerProps {
  items: AttentionItem[]
}

export function AttentionBanner({ items }: AttentionBannerProps) {
  if (items.length === 0) return null

  return (
    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
      <h3 className="text-sm font-semibold text-amber-800 mb-2">Attention</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-amber-900">
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
