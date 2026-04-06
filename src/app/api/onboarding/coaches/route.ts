import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()

    const { data: coaches } = await admin
      .from('coach')
      .select('id, name')
      .eq('status', 'active')
      .order('name')

    return NextResponse.json({ coaches: coaches || [] })
  } catch (error) {
    console.error('Error fetching coaches:', error)
    return NextResponse.json({ coaches: [] })
  }
}
