'use client'

import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Logged-out landing. v2 visual language (Card on the v2 gray
 * background, v2 type scale). Behavior is byte-identical to the prior
 * implementation — passwordless magic-link via signInWithOtp, the same
 * emailRedirectTo, the same rejection notice and "check your email"
 * state. Presentation-only refresh.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<Shell><LoadingBody /></Shell>}>
      <LoginForm />
    </Suspense>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-6">
          {children}
        </div>
      </div>
    </main>
  )
}

function Brand({ sub }: { sub: string }) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold text-green-900">LE3 Growth Portfolio</h1>
      <p className="text-sm text-gray-500 mt-1">{sub}</p>
    </div>
  )
}

function LoadingBody() {
  return <Brand sub="Loading…" />
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  // /api/auth/callback redirects here with ?error=not_enrolled when an
  // authenticated email isn't a student/coach and isn't on ADMIN_EMAILS.
  // Derived inline so it renders on first paint.
  const rejectionNotice =
    searchParams?.get('error') === 'not_enrolled'
      ? "That email isn't enrolled in the LE3 program. If you believe this is a mistake, contact your LE3 coach or program staff."
      : null

  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    return supabaseRef.current
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = getSupabase()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <div className="text-4xl">📬</div>
          <h1 className="text-lg font-bold text-green-900">Check your email</h1>
          <p className="text-sm text-gray-600">
            We sent a sign-in link to <strong>{email}</strong>. Click the
            link in your email to sign in.
          </p>
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="text-sm text-green-700 hover:text-green-900 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <Brand sub="Enter your NLU email to sign in" />

      {rejectionNotice && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {rejectionNotice}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@nlu.edu"
          required
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white placeholder:text-gray-400"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-3 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Sign-In Link'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center">
        No password needed. We&apos;ll email you a secure link.
      </p>

      <div className="text-center pt-2 border-t border-gray-100">
        <Link
          href="/v2/demo"
          className="text-sm text-green-700 hover:text-green-900 hover:underline"
        >
          Just exploring? Try the demo &rarr;
        </Link>
      </div>
    </Shell>
  )
}
