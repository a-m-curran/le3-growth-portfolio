import { getCurrentStudent, getSkillCoverage } from '@/lib/queries'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { NarrativeCard } from '@/components/narrative/NarrativeCard'

export default async function NarrativesPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const admin = createAdminClient()

  // Get coverage data (for skill/pillar info)
  const coverage = await getSkillCoverage(student.id)

  // Get existing narratives
  const { data: narrativeRows } = await admin
    .from('skill_narrative')
    .select('*')
    .eq('student_id', student.id)
    .order('version', { ascending: false })

  // Deduplicate to latest version per skill
  const narrativeMap = new Map<string, Record<string, unknown>>()
  for (const n of (narrativeRows || [])) {
    if (!narrativeMap.has(n.skill_id)) {
      narrativeMap.set(n.skill_id, n)
    }
  }

  // Group by pillar
  const pillarGroups = new Map<string, { pillarName: string; skills: typeof coverage }>()
  for (const cov of coverage) {
    if (!pillarGroups.has(cov.pillarId)) {
      pillarGroups.set(cov.pillarId, { pillarName: cov.pillarName, skills: [] })
    }
    pillarGroups.get(cov.pillarId)!.skills.push(cov)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Skill Narratives</h1>
      <p className="text-sm text-gray-500 mb-6">
        Your growth story for each skill, built from your conversations and reflections.
      </p>

      <div className="space-y-8">
        {Array.from(pillarGroups.entries()).map(([pillarId, group]) => (
          <section key={pillarId}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {group.pillarName}
            </h2>
            <div className="space-y-4">
              {group.skills.map(cov => {
                const narrative = narrativeMap.get(cov.skillId)
                return (
                  <NarrativeCard
                    key={cov.skillId}
                    skillId={cov.skillId}
                    skillName={cov.skillName}
                    pillarName={cov.pillarName}
                    narrativeText={narrative?.narrative_text as string | undefined}
                    narrativeRichness={narrative?.narrative_richness as string | undefined}
                    version={narrative?.version as number | undefined}
                    generatedAt={narrative?.generated_at as string | undefined}
                    conversationCount={cov.completedConversations}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
