'use client'

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/auth-helpers-nextjs'

export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
