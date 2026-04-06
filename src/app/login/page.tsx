'use client'

import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useState, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

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
      <main className="min-h-screen flex items-center justify-center bg-green-50 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="text-xl font-bold text-green-900">Check your email</h1>
          <p className="text-sm text-gray-600">
            We sent a sign-in link to <strong>{email}</strong>.
            Click the link in your email to sign in.
          </p>
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="text-sm text-green-700 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-green-50 px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-900">LE3 Growth Portfolio</h1>
          <p className="text-sm text-gray-600 mt-2">Enter your NLU email to sign in</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@nlu.edu"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Sign-In Link'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center">
          No password needed. We&apos;ll email you a secure link.
        </p>
      </div>
    </main>
  )
}
