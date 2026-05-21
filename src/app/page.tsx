import { redirect } from 'next/navigation'

// v2 is the only surface. /v2 identity-routes: coach → /v2/coach,
// student → /v2/today, no identity → /login. Demo personas arrive via
// direct links at /demo/aja and /demo/elizabeth.
export default function Home() {
  redirect('/v2')
}
