'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface MeViewProps {
  kind: 'student' | 'coach'
  name: string
  email: string
  meta: string
  nluId?: string
  programStartDate?: string
}

export function MeView({ kind, name, email, meta, nluId, programStartDate }: MeViewProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    // Browser-side Supabase client just to clear the session locally;
    // the @supabase/auth-helpers-nextjs cookies will be cleared by the
    // signOut call.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      {/* Identity */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xl font-semibold">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{name}</h1>
            <p className="text-sm text-gray-500 truncate">{email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
          </div>
        </div>

        {kind === 'student' && (
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
            {nluId && (
              <Field label="NLU ID" value={nluId} />
            )}
            {programStartDate && (
              <Field
                label="Program started"
                value={new Date(programStartDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              />
            )}
          </div>
        )}
      </Card>

      {/* Preferences (stubs) */}
      <Card>
        <SectionHeader title="Preferences" />
        <ul className="space-y-1 text-sm">
          <PrefRow label="Email notifications" value="Coming soon" />
          <PrefRow label="Push notifications" value="Coming soon" />
          <PrefRow label="Data handling preferences" value="View consent notice" />
        </ul>
      </Card>

      {/* Account actions */}
      <Card>
        <SectionHeader title="Account" />
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-700 hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </Card>

      <p className="text-[11px] text-gray-400 text-center">
        Questions about your data?{' '}
        {kind === 'student' ? 'Reach out to your LE3 coach.' : 'Contact NLU IT support.'}
      </p>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">{children}</div>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{value}</div>
    </div>
  )
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-700">{label}</span>
      <span className="text-xs text-gray-400">{value}</span>
    </li>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || '')
    .join('')
}
