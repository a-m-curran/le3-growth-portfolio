'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { skills, pillars } from '@/data'

export default function DemoReflectionPage() {
  const router = useRouter()
  const [description, setDescription] = useState(
    'I had a really hard conversation with a classmate about our group project direction. I disagreed with the approach but didn\'t want to create conflict. Eventually I spoke up and it actually went better than I expected.'
  )
  const [skillId, setSkillId] = useState('skill_communication')
  const [loading, setLoading] = useState(false)

  const activeSkills = skills.filter(s => s.isActive)
  const pillarMap = new Map<string, { name: string; skills: typeof activeSkills }>()
  for (const skill of activeSkills) {
    const pillar = pillars.find(p => p.id === skill.pillarId)
    if (!pillarMap.has(skill.pillarId)) {
      pillarMap.set(skill.pillarId, { name: pillar?.name || '', skills: [] })
    }
    pillarMap.get(skill.pillarId)!.skills.push(skill)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulate a brief loading then navigate to a demo conversation
    setTimeout(() => {
      // Navigate to Aja's first conversation as a stand-in
      router.push('/demo/conversation/work_aja_onboarding?student=stu_aja')
    }, 1500)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Create a Reflection</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describe an experience you&apos;d like to reflect on. It doesn&apos;t need to be tied to a specific assignment.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            What happened?
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Which skill does this relate to?
          </label>
          <div className="space-y-3">
            {Array.from(pillarMap.entries()).map(([pillarId, group]) => (
              <div key={pillarId}>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSkillId(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        skillId === s.id
                          ? 'bg-green-700 text-white border-green-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !description.trim()}
          className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting reflection...' : 'Start Reflection'}
        </button>
      </form>
    </main>
  )
}
