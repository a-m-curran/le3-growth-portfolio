import { skills, pillars, getStudentConversations, getWorkWithTags } from '@/data'
import Link from 'next/link'
import { SkillCoverageBar } from '@/components/conversation/SkillCoverageBar'
import type { SkillCoverageData } from '@/lib/types'
import * as staticData from '@/data'

interface Props {
  searchParams: { student?: string }
}

export default function DemoConversationPage({ searchParams }: Props) {
  const studentId = searchParams.student || 'stu_aja'
  const allConversations = getStudentConversations(studentId)
  const allWorkWithTags = getWorkWithTags(studentId)
  const activeSkills = skills.filter(s => s.isActive)

  // Build coverage data
  const coverage: SkillCoverageData[] = activeSkills.map(skill => {
    const pillar = pillars.find(p => p.id === skill.pillarId)
    const convos = staticData.getConversationsForSkill(studentId, skill.id)
    const taggedWork = allWorkWithTags.filter(w => w.skillTags.some(t => t.skillId === skill.id))
    return {
      skillId: skill.id,
      skillName: skill.name,
      pillarId: skill.pillarId,
      pillarName: pillar?.name || '',
      taggedAssignments: Math.max(taggedWork.length, convos.length),
      completedConversations: convos.length,
      coverageRatio: taggedWork.length > 0 ? convos.length / taggedWork.length : (convos.length > 0 ? 1 : 0),
    }
  })

  // Group work by skill
  const workBySkill = new Map<string, typeof allWorkWithTags>()
  for (const work of allWorkWithTags) {
    if (work.skillTags.length > 0) {
      const primary = work.skillTags[0].skillId
      if (!workBySkill.has(primary)) workBySkill.set(primary, [])
      workBySkill.get(primary)!.push(work)
    }
  }

  const sortedCoverage = [...coverage].sort((a, b) => a.completedConversations - b.completedConversations)

  // Group coverage by pillar
  const pillarGroups = new Map<string, { pillarName: string; skills: SkillCoverageData[] }>()
  for (const c of sortedCoverage) {
    if (!pillarGroups.has(c.pillarId)) {
      pillarGroups.set(c.pillarId, { pillarName: c.pillarName, skills: [] })
    }
    pillarGroups.get(c.pillarId)!.skills.push(c)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-green-900 mb-1">Growth Conversations</h1>
          <p className="text-sm text-gray-500">Reflect on your work through guided conversations.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/demo/reflection/new" className="text-sm px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap">
            + Reflect
          </Link>
          <Link href="/demo/work/import" className="text-sm px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
            Import
          </Link>
        </div>
      </div>

      {/* Waiting for conversations — grouped by skill */}
      {(() => {
        // Get unreflected work with tags
        const unreflected = allWorkWithTags.filter(w => {
          const hasConvo = allConversations.some(c => c.workId === w.id)
          return !hasConvo && w.skillTags.length > 0
        })

        if (unreflected.length === 0) return null

        // Group by primary skill, sorted by coverage priority
        const bySkill = new Map<string, typeof unreflected>()
        for (const w of unreflected) {
          const primary = w.skillTags[0].skillId
          if (!bySkill.has(primary)) bySkill.set(primary, [])
          bySkill.get(primary)!.push(w)
        }

        return (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
              Ready for Reflection ({unreflected.length})
            </h2>
            <div className="space-y-4">
              {sortedCoverage.map(cov => {
                const works = bySkill.get(cov.skillId)
                if (!works || works.length === 0) return null
                return (
                  <div key={cov.skillId}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">{cov.skillName}</h3>
                      <div className="w-24">
                        <SkillCoverageBar coverage={cov} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {works.map(w => (
                        <Link
                          key={w.id}
                          href={`/demo/conversation/${w.id}?student=${studentId}`}
                          className="block p-3 rounded-lg border border-amber-200 bg-white hover:border-green-400 hover:shadow-sm transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{w.title}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {w.courseName && `${w.courseName} · `}
                                {new Date(w.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <span className="text-xs text-green-700 font-medium shrink-0 ml-2">Start →</span>
                          </div>
                          {w.skillTags.length > 1 && (
                            <div className="flex gap-1 mt-1.5">
                              {w.skillTags.slice(1).map(t => (
                                <span key={t.skillId} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                  {t.skillName}
                                </span>
                              ))}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })()}

      {/* Skill coverage overview */}
      {coverage.some(c => c.taggedAssignments > 0 || c.completedConversations > 0) && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Skill Coverage
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {Array.from(pillarGroups.entries()).map(([pillarId, group]) => (
              <div key={pillarId} className="mb-3 last:mb-0">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">
                  {group.pillarName}
                </p>
                <div className="space-y-1.5">
                  {group.skills.map(cov => (
                    <div key={cov.skillId} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-32 truncate">{cov.skillName}</span>
                      <div className="flex-1">
                        <SkillCoverageBar coverage={cov} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed conversations */}
      {allConversations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Completed ({allConversations.length})
          </h2>
          <div className="space-y-3">
            {allConversations.slice().reverse().map(conv => {
              const work = conv.workId ? staticData.getStudentWork(conv.workId) : null
              return (
                <div
                  key={conv.id}
                  className="p-4 rounded-xl bg-white border border-gray-200 opacity-75"
                >
                  <h3 className="font-medium text-gray-900 text-sm">
                    {work?.title || conv.workContext || 'Reflection'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(conv.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="ml-2 text-green-600">Completed</span>
                  </p>
                  {conv.synthesisText && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
                      {conv.synthesisText.substring(0, 120)}...
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
