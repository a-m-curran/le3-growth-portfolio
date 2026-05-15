import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client that bypasses RLS — server-side only.
 *
 * MEMOIZED SINGLETON. The first real 56-course LE3 sync OOM-killed the
 * Trigger.dev worker because the sync engine calls createAdminClient()
 * inside its per-course / per-student / per-submission loops (9 call
 * sites, thousands of invocations for a full cohort). Each createClient()
 * spins up its own PostgREST, GoTrue, Realtime and Storage sub-clients,
 * fetch layer, and — critically — an autoRefreshToken setInterval timer.
 * Thousands of those accumulate faster than V8 can reclaim them.
 *
 * The service-role client is stateless with respect to callers: it
 * authenticates with a fixed service key and bypasses RLS, so there is
 * no per-request/per-user context that would make sharing unsafe. One
 * shared instance is the recommended Supabase server pattern.
 *
 * auth options:
 *   - persistSession:   false — no session store needed for a key-auth
 *                        client; nothing to persist between calls.
 *   - autoRefreshToken: false — the service role key doesn't expire and
 *                        isn't refreshed; leaving this on starts a
 *                        background setInterval per client (the timer
 *                        leak that compounded the OOM).
 *
 * Memoized at module scope. On Vercel/Trigger.dev this is per-worker-
 * instance, which is exactly the desired lifetime — one client reused
 * for the life of the process instead of one per DB call.
 */
let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
  return cached
}
