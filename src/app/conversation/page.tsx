import { getCurrentStudent, getAllStudentConversations, getSkillCoverage, getAvailableWorkWithTags } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { GrowthConversation, SkillCoverageData, StudentWork } from '@/lib/types'
import { SkillCoverageBar } from '@/components/conversation/SkillCoverageBar'

type WorkWithTags = StudentWork & { skillTags: { skillId: string; skillName: string }[] }

export default async function ConversationPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const [allConversations, coverage, availableWork] = await Promise.all([
    getAllStudentConversations(student.id),
    getSkillCoverage(student.id),
    getAvailableWorkWithTags(student.id),
  ])

  const inProgress = allConversations.filter(c => c.status === 'in_progress')
  const completed = allConversations.filter(c => c.status === 'completed')

  // Group available work by primary skill tag
  const workBySkill = new Map<string, WorkWithTags[]>()
  const untaggedWork: WorkWithTags[] = []

  for (const work of availableWork) {
    if (work.skillTags.length > 0) {
      const primarySkill = work.skillTags[0].skillId
      if (!workBySkill.has(primarySkill)) workBySkill.set(primarySkill, [])
      workBySkill.get(primarySkill)!.push(work)
    } else {
      untaggedWork.push(work)
    }
  }

  // Sort coverage by least conversations first (prioritize underrepresented skills)
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-green-900 mb-1">Growth Conversations</h1>
          <p className="text-sm text-gray-500">
            Reflect on your work through guided conversations.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reflection/new"
            className="text-sm px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
          >
            + Reflect
          </Link>
          <Link
            href="/work/submit"
            className="text-sm px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors whitespace-nowrap"
          >
            + Submit
          </Link>
          <Link
            href="/work/import"
            className="text-sm px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Import
          </Link>
        </div>
      </div>

      {/* In-progress conversations */}
      {inProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
            In Progress
          </h2>
          <div className="space-y-3">
            {inProgress.map(conv => (
              <ConversationCard key={conv.id} conversation={conv} />
            ))}
          </div>
        </section>
      )}

      {/* Available work grouped by skill */}
      {(workBySkill.size > 0 || untaggedWork.length > 0) && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Ready for Reflection
          </h2>

          {/* Skill-grouped work */}
          {sortedCoverage.map(cov => {
            const works = workBySkill.get(cov.skillId)
            if (!works || works.length === 0) return null

            return (
              <div key={cov.skillId} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">{cov.skillName}</h3>
                  <div className="w-24">
                    <SkillCoverageBar coverage={cov} />
                  </div>
                </div>
                <div className="space-y-2">
                  {works.map(work => (
                    <WorkCard key={work.id} work={work} studentId={student.id} />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Untagged work */}
          {untaggedWork.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Untagged</h3>
              <div className="space-y-2">
                {untaggedWork.map(work => (
                  <WorkCard key={work.id} work={work} studentId={student.id} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {inProgress.length === 0 && completed.length === 0 && availableWork.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No conversations yet.</p>
          <p className="text-sm mb-4">
            Submit work or create a reflection to get started.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/work/submit"
              className="px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
            >
              Submit Work
            </Link>
            <Link
              href="/reflection/new"
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Create Reflection
            </Link>
          </div>
        </div>
      )}

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
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Completed ({completed.length})
          </h2>
          <div className="space-y-3">
            {completed.map(conv => (
              <ConversationCard key={conv.id} conversation={conv} completed />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

// ─── SUB-COMPONENTS ──────────────────────────────────

function ConversationCard({
  conversation,
  completed = false,
}: {
  conversation: GrowthConversation & { workTitle?: string }
  completed?: boolean
}) {
  const isReflection = conversation.conversationType === 'open_reflection'
  const workTitle = isReflection
    ? (conversation.reflectionDescription?.substring(0, 60) || 'Open Reflection')
    : ((conversation as unknown as { workTitle?: string }).workTitle || conversation.workContext || 'Reflection')

  const date = new Date(conversation.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  let phase = 'Phase 1'
  if (conversation.responsePhase1 && conversation.promptPhase2) phase = 'Phase 2'
  if (conversation.responsePhase2 && conversation.promptPhase3) phase = 'Phase 3'

  return (
    <Link
      href={completed ? '#' : `/conversation/${conversation.workId || conversation.id}`}
      className={`block p-4 rounded-xl bg-white border transition-colors ${
        completed
          ? 'border-gray-200 opacity-75'
          : 'border-amber-200 hover:border-green-400 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 text-sm truncate">{workTitle}</h3>
            {isReflection && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full shrink-0">
                Reflection
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {date}
            {!completed && (
              <span className="ml-2 text-amber-600 font-medium">{phase} &middot; Resume &rarr;</span>
            )}
            {completed && (
              <span className="ml-2 text-green-600">Completed</span>
            )}
          </p>
        </div>
        {!completed && (
          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium shrink-0">
            In progress
          </span>
        )}
      </div>
      {completed && conversation.synthesisText && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
          {conversation.synthesisText.substring(0, 120)}...
        </p>
      )}
    </Link>
  )
}

function WorkCard({ work, studentId }: { work: WorkWithTags; studentId: string }) {
  const date = new Date(work.submittedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Link
      href={`/conversation/${work.id}?student=${studentId}`}
      className="block p-3 rounded-lg border border-gray-200 bg-white hover:border-green-400 hover:shadow-sm transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">{work.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {work.courseName && `${work.courseName} · `}{date}
          </p>
        </div>
        <span className="text-xs text-green-700 font-medium shrink-0 ml-2">Start &rarr;</span>
      </div>
      {work.skillTags.length > 1 && (
        <div className="flex gap-1 mt-1.5">
          {work.skillTags.slice(1).map(t => (
            <span key={t.skillId} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              {t.skillName}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
