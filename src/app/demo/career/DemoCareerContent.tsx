'use client'

import { getCareerOutput } from '@/data'
import { useDemoReveal } from '@/lib/hooks/useDemoReveal'

interface Props {
  studentId: string
}

export function DemoCareerContent({ studentId }: Props) {
  const career = getCareerOutput(studentId)
  const { revealed, loading, trigger } = useDemoReveal(3000)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Career & Resume</h1>
      <p className="text-sm text-gray-500 mb-6">
        Professional language synthesized from your growth narratives.
      </p>

      {!revealed && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            Generate resume-ready language from your skill narratives.
          </p>
          <button
            onClick={trigger}
            className="px-6 py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Generate Career Output
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-pulse text-green-700 text-lg mb-2">Synthesizing your narratives...</div>
          <p className="text-sm text-gray-500">Building resume language and interview talking points</p>
        </div>
      )}

      {revealed && career && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Professional Summary
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-700 leading-relaxed">{career.resumeSummary}</p>
              <button
                onClick={() => navigator.clipboard?.writeText(career.resumeSummary)}
                className="mt-3 text-xs text-green-700 hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Skill Descriptions
            </h2>
            <div className="space-y-4">
              {career.skillDescriptions.map(sd => (
                <div key={sd.skillId} className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-2">{sd.skillName}</h3>
                  <p className="text-sm text-gray-700 mb-3">{sd.resumeLanguage}</p>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Interview Talking Points:</p>
                    <ul className="space-y-1.5">
                      {sd.talkingPoints.map((tp, i) => (
                        <li key={i} className="text-sm text-gray-600 pl-3 border-l-2 border-green-200">
                          {tp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
