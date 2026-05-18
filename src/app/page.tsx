import { redirect } from 'next/navigation'

// v2 is the only surface. /v2 identity-routes: coach → /v2/coach,
// student → /v2/today, demo mode → /v2/demo, no identity → /login.
export default function Home() {
  redirect('/v2')
}
