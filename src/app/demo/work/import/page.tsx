'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDemoReveal } from '@/lib/hooks/useDemoReveal'

const DEMO_RESULTS = [
  { title: 'Research Paper: Organizational Culture Analysis', skills: ['critical_thinking', 'communication'], type: 'essay' },
  { title: 'Group Survey Design Project', skills: ['collaboration', 'creative_problem_solving'], type: 'project' },
  { title: 'Week 3 Discussion: Power Dynamics', skills: ['social_awareness', 'critical_thinking'], type: 'discussion_post' },
  { title: 'Leadership Case Study Presentation', skills: ['communication', 'initiative'], type: 'presentation' },
  { title: 'Peer Interview & Reflection', skills: ['empathy', 'relationship_building'], type: 'essay' },
]

export default function DemoImportPage() {
  const [hasFile, setHasFile] = useState(false)
  const { revealed, loading, trigger } = useDemoReveal(3000)

  const handleImport = () => {
    trigger()
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-green-900 mb-1">Import Assignments</h1>
          <p className="text-sm text-gray-500">
            Upload a CSV file to bulk-import assignments. Skills are auto-tagged.
          </p>
        </div>
        <Link href="/demo/conversation" className="text-sm text-green-700 hover:underline">
          Back
        </Link>
      </div>

      {!revealed ? (
        <div className="space-y-4">
          <div
            onClick={() => setHasFile(true)}
            className={`w-full px-4 py-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
              hasFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
            }`}
          >
            {hasFile ? (
              <div>
                <p className="text-sm font-medium text-green-800">soc155_assignments.csv</p>
                <p className="text-xs text-gray-500 mt-1">2.4 KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Click to select a CSV file</p>
                <p className="text-xs text-gray-400 mt-1">Columns: title, type, course, description</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
            <p className="font-medium mb-1">CSV Format:</p>
            <code className="block text-[11px] text-gray-500 whitespace-pre">
{`title,type,course,description
"Research Paper",essay,SOC 155,"Analysis of org culture"
"Group Project",project,SOC 155,"Team survey design"`}
            </code>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="animate-pulse text-green-700 text-sm mb-1">Importing & auto-tagging skills...</div>
              <p className="text-xs text-gray-400">Each assignment is being analyzed for skill tags</p>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!hasFile || loading}
            className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Import Assignments'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-800">
              Imported {DEMO_RESULTS.length} of {DEMO_RESULTS.length} assignments
            </p>
          </div>

          <div className="space-y-2">
            {DEMO_RESULTS.map((r, i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-200 bg-white text-sm">
                <div className="font-medium text-gray-900">{r.title}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.skills.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/demo/conversation"
            className="block w-full py-2 bg-green-700 text-white rounded-lg text-sm font-medium text-center hover:bg-green-800 transition-colors"
          >
            View Conversations
          </Link>
        </div>
      )}
    </main>
  )
}
