import { getCurrentStudent, getAllStudentConversations } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ReflectForm } from './ReflectForm'
import type { GrowthConversation } from '@/lib/types'

export default async function ReflectPage() {
  const student = await getCurrentStudent()
  if (!student) redirect('/login')

  const allConversations = await getAllStudentConversations(student.id)
  const reflections = allConversations.filter(c => c.conversationType === 'open_reflection')
  const completed = reflections.filter(c => c.status === 'completed')
  const inProgress = reflections.filter(c => c.status === 'in_progress')

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-green-900 mb-1">Reflection</h1>
        <p className="text-sm text-gray-500">
          Something on your mind? Describe what happened and we&apos;ll think through it together.
        </p>
      </div>

      <ReflectForm />

      {/* In-progress reflections */}
      {inProgress.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
            In Progress
          </h2>
          <div className="space-y-3">
            {inProgress.map(r => (
              <ReflectionCard key={r.id} reflection={r} />
            ))}
          </div>
        </section>
      )}

      {/* Past reflections */}
      {completed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Past Reflections ({completed.length})
          </h2>
          <div className="space-y-3">
            {completed.map(r => (
              <ReflectionCard key={r.id} reflection={r} completed />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function ReflectionCard({ reflection, completed = false }: { reflection: GrowthConversation; completed?: boolean }) {
  const description = reflection.reflectionDescription || reflection.workContext || 'Reflection'
  const date = new Date(reflection.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  let phase = 'Phase 1'
  if (reflection.responsePhase1 && reflection.promptPhase2) phase = 'Phase 2'
  if (reflection.responsePhase2 && reflection.promptPhase3) phase = 'Phase 3'

  return (
    <Link
      href={completed ? '#' : `/conversation/${reflection.id}`}
      className={`block p-4 rounded-xl bg-white border transition-colors ${
        completed
          ? 'border-gray-200 opacity-75'
          : 'border-amber-200 hover:border-green-400 hover:shadow-sm'
      }`}
    >
      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{description}</h3>
      <p className="text-xs text-gray-500 mt-1">
        {date}
        {!completed && (
          <span className="ml-2 text-amber-600 font-medium">{phase} &middot; Resume &rarr;</span>
        )}
        {completed && (
          <span className="ml-2 text-green-600">Completed</span>
        )}
      </p>
      {completed && reflection.synthesisText && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
          {reflection.synthesisText.substring(0, 120)}...
        </p>
      )}
    </Link>
  )
}
