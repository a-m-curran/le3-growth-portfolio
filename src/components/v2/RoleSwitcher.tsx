'use client'

/**
 * Dual-role-only control: switch the active v2 experience. A native
 * form POST to /api/v2/switch-role — the server validates the user
 * actually owns the target role before honoring it (security spine
 * lives server-side; this is just the trigger). Only mounted by
 * AppShell when identity.dualRole is true. No client state needed:
 * the browser follows the route's 302 + Set-Cookie.
 */
export function RoleSwitcher({ role }: { role: 'student' | 'coach' }) {
  const target = role === 'coach' ? 'student' : 'coach'
  const label = target === 'student' ? 'Switch to Student' : 'Switch to Coach'
  return (
    <form
      action={`/api/v2/switch-role?role=${target}`}
      method="POST"
      className="px-3 py-2"
    >
      <button
        type="submit"
        className="w-full text-left text-xs font-medium text-green-800 hover:text-green-900 hover:underline"
      >
        {label} &rarr;
      </button>
    </form>
  )
}
