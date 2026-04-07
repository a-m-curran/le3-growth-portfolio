'use client'

import { useState } from 'react'
import { skills, pillars, getSkillNarrative } from '@/data'
import { useDemoReveal } from '@/lib/hooks/useDemoReveal'

const PLACEHOLDER_NARRATIVES: Record<string, string> = {
  skill_curiosity: "You ask questions that other people skip over. Not because you're trying to impress anyone, but because you genuinely want to understand how things work beneath the surface.\n\nIt started showing up in small ways — asking \"why\" in class when everyone else was writing down the answer. But it's become something bigger. You dig into topics that aren't on the test, you follow threads that interest you even when they don't \"count,\" and you've started bringing questions from one class into another.\n\nThe momentum is there. You're not just curious about the material anymore — you're curious about your own curiosity.",
  skill_empathy: "You've always cared about people. But there's a difference between caring and understanding, and you're starting to see it.\n\nIn group work, you've moved from just being \"nice\" to actually trying to understand where your teammates are coming from. When someone pushes back on an idea, you pause now instead of getting defensive. That pause is new, and it matters.\n\nYou're building the kind of empathy that doesn't just feel — it listens.",
  skill_communication: "The way you express yourself has shifted. Not louder — clearer.\n\nEarly on, you wrote to fill the page. Now your writing has a point, and you make it without hedging. In presentations, you've gone from reading slides to actually talking to the room.\n\nYou're starting to adjust how you communicate based on who you're talking to. That's a real skill, and it's one you're developing faster than you probably realize.",
  skill_adaptability: "Plans change. You used to fight that. Now you work with it.\n\nWhen childcare fell through before your midterm, you didn't spiral — you called your professor before class and made a plan. When your group project data was unusable, you were the one who suggested pivoting. These aren't small things.\n\nYou're learning that flexibility isn't about giving up on what you want. It's about finding another way to get there.",
  skill_collaboration: "Working with other people used to stress you out. Not because you didn't want to — but because you didn't trust the process.\n\nThat's changing. You organized a study group when nobody else would. You stayed in a group project when it would have been easier to go solo. You're starting to see that the friction of collaboration is part of the learning.\n\nYou're not just participating anymore. You're contributing.",
  skill_networking: "You're starting to see connections as more than just contacts. The relationships you're building — with your professor at office hours, with the peer you're mentoring, with your supervisor at work — they're becoming part of how you navigate.\n\nYou don't just know people. You know how to show up for them.",
  skill_relationship_building: "Trust takes time. You know that now because you've lived it.\n\nThe study group you organized, the shift swap you negotiated, the mentoring you've done — these aren't transactions. They're relationships you've invested in. And they've invested back.\n\nYou're building a network that will hold you up when things get hard.",
  skill_social_awareness: "You notice things other people don't. The person who went quiet in the group meeting. The tension between the two people who aren't saying what they really think.\n\nYou're reading rooms better than you used to. And more importantly, you're using what you notice — not just observing, but responding. That awareness is becoming a strength.",
}

interface Props {
  studentId: string
}

export function DemoNarrativeContent({ studentId }: Props) {
  const activeSkills = skills.filter(s => s.isActive)

  const pillarGroups = new Map<string, { pillarName: string; skills: typeof activeSkills }>()
  for (const skill of activeSkills) {
    const pillar = pillars.find(p => p.id === skill.pillarId)
    if (!pillarGroups.has(skill.pillarId)) {
      pillarGroups.set(skill.pillarId, { pillarName: pillar?.name || '', skills: [] })
    }
    pillarGroups.get(skill.pillarId)!.skills.push(skill)
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
              {group.skills.map(skill => {
                const narrative = getSkillNarrative(studentId, skill.id)
                return (
                  <DemoNarrativeCard
                    key={skill.id}
                    skillName={skill.name}
                    pillarName={group.pillarName}
                    existingText={narrative?.narrativeText}
                    existingRichness={narrative?.narrativeRichness}
                    placeholderText={PLACEHOLDER_NARRATIVES[skill.id]}
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

function DemoNarrativeCard({
  skillName,
  pillarName,
  existingText,
  existingRichness,
  placeholderText,
}: {
  skillName: string
  pillarName: string
  existingText?: string
  existingRichness?: string
  placeholderText?: string
}) {
  const { revealed, loading, trigger } = useDemoReveal(2500)
  const [showExisting] = useState(!!existingText)

  const displayText = showExisting ? existingText : (revealed ? (placeholderText || 'Narrative generated.') : null)
  const richness = showExisting ? existingRichness : (revealed ? 'developing' : null)

  const richnessColor: Record<string, string> = {
    thin: 'bg-gray-100 text-gray-600',
    developing: 'bg-amber-100 text-amber-700',
    rich: 'bg-green-100 text-green-700',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{skillName}</h3>
          <p className="text-xs text-gray-500">{pillarName}</p>
        </div>
        {richness && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${richnessColor[richness] || ''}`}>
            {richness}
          </span>
        )}
      </div>

      {displayText ? (
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-4">
          {displayText}
        </div>
      ) : loading ? (
        <div className="py-6 text-center">
          <div className="animate-pulse text-green-700 text-sm mb-1">Generating narrative...</div>
          <p className="text-xs text-gray-400">Analyzing conversations and building your growth story</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic mb-4">
          No narrative generated yet.
        </p>
      )}

      {!showExisting && !revealed && !loading && (
        <button
          onClick={trigger}
          className="text-sm px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
        >
          Generate Narrative
        </button>
      )}
    </div>
  )
}
