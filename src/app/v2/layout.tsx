/**
 * v2 root layout — passthrough only.
 *
 * Auth gating moved DOWN to the (student) and (coach) group layouts,
 * /v2/me, and /v2/page.tsx so that /v2/demo (the persona-picker entry
 * point) is accessible without authentication. The trade-off is that
 * each surface handles its own redirect, but the win is "anyone can
 * land at /v2/demo and try the demo" without first needing to sign in.
 *
 * Shell wrapping also happens in the group layouts, not here, so
 * URL determines shell instead of auth role.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
