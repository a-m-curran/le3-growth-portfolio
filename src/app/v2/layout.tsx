/**
 * v2 root layout — passthrough only.
 *
 * Auth gating lives in the (student) and (coach) group layouts plus
 * /v2/me and /v2/page.tsx. No identity → /login (no exceptions).
 * Demo personas are reached via the two direct-link routes outside
 * /v2 (/demo/aja, /demo/elizabeth), which set the persona cookie and
 * let the regular identity path resolve them as real student/coach
 * rows.
 *
 * Shell wrapping also happens in the group layouts, not here, so
 * URL determines shell instead of auth role.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
