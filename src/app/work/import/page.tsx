'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface ImportResult {
  title: string
  skills: string[]
  error?: string
}

export default function ImportWorkPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [stats, setStats] = useState<{ total: number; processed: number } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/work/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Import failed')
        setLoading(false)
        return
      }

      setResults(data.results)
      setStats({ total: data.total, processed: data.processed })
      setLoading(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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
        <Link href="/work/submit" className="text-sm text-green-700 hover:underline">
          Single upload
        </Link>
      </div>

      {!results ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`w-full px-4 py-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
              file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-green-800">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Click to upload a CSV file</p>
                <p className="text-xs text-gray-400 mt-1">
                  Columns: title, description, type, course, date
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
            <p className="font-medium mb-1">CSV Format:</p>
            <code className="block text-[11px] text-gray-500 whitespace-pre">
{`title,type,course,description,date
"Research Paper",essay,SOC 155,"Analysis of org culture",2026-03-15
"Group Project",project,SOC 155,"Team survey design",2026-03-22`}
            </code>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing & auto-tagging skills...' : 'Import Assignments'}
          </button>

          {loading && (
            <p className="text-xs text-gray-500 text-center">
              Each assignment is being analyzed for skill tags. This may take a moment.
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-800">
              Imported {stats?.processed} of {stats?.total} assignments
            </p>
          </div>

          {/* Results list */}
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border text-sm ${
                  r.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-medium text-gray-900">{r.title}</div>
                {r.error ? (
                  <p className="text-xs text-red-600 mt-1">{r.error}</p>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.skills.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        {s.replace('skill_', '').replace(/_/g, ' ')}
                      </span>
                    ))}
                    {r.skills.length === 0 && (
                      <span className="text-xs text-gray-400">No skills tagged</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/conversation"
              className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-medium text-center hover:bg-green-800 transition-colors"
            >
              View Conversations
            </Link>
            <button
              onClick={() => { setResults(null); setFile(null); setStats(null) }}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
