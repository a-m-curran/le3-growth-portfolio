export interface DemoCareerOutput {
  studentId: string
  resumeSummary: string
  skillDescriptions: {
    skillId: string
    skillName: string
    resumeLanguage: string
    talkingPoints: string[]
  }[]
  version: number
}

export const careerOutputs: DemoCareerOutput[] = [
  {
    studentId: 'stu_aja',
    resumeSummary:
      'Resourceful and self-motivated student with demonstrated ability to identify problems and create practical solutions in academic and professional settings. Experienced in organizing collaborative learning environments, redesigning research methods for accessibility, and independently building tools that improve workplace operations. Brings a reflective, growth-oriented approach to challenges and a commitment to doing meaningful work.',
    skillDescriptions: [
      {
        skillId: 'skill_resilience',
        skillName: 'Resilience',
        resumeLanguage:
          'Navigates setbacks with a learning-oriented mindset, consistently seeking resources and support to overcome obstacles rather than disengaging. Demonstrates increasing self-awareness and adaptability when facing academic, professional, and personal challenges simultaneously.',
        talkingPoints: [
          'When my childcare fell through on the morning of a midterm, I called my professor before class to arrange an alternative instead of missing the exam. That experience taught me that advocating for myself in difficult moments is harder than giving up, but always leads to a better outcome.',
          'I failed a statistics quiz and went to office hours the same afternoon. I used to see setbacks as proof I wasn\'t smart enough, but I\'ve learned to treat them as information about what I need to work on next.',
          'Over three quarters I\'ve shifted from handling problems alone to building a network of support — writing centers, study groups, professors. I now define resilience as knowing when to push through, when to ask for help, and how to learn from things that don\'t go as planned.',
        ],
      },
      {
        skillId: 'skill_initiative',
        skillName: 'Initiative',
        resumeLanguage:
          'Proactively identifies unmet needs and creates solutions without external prompting. Organized a peer study group that grew to eight regular members, and independently learned new technical skills to improve workplace operations.',
        talkingPoints: [
          'I noticed my statistics class was struggling collectively, so I organized a study group that now meets weekly with eight regular members. It started with one text to a classmate and grew from there.',
          'At my campus job, I saw my manager tracking inventory on paper and taught myself Excel from YouTube tutorials on my own time. I built a spreadsheet system that my manager now uses daily, and it led to additional responsibilities.',
          'I\'ve learned that I don\'t need to wait for permission to solve a problem. If I see something that needs to happen, I trust myself to figure out how to make it happen.',
        ],
      },
      {
        skillId: 'skill_creative_problem_solving',
        skillName: 'Creative Problem Solving',
        resumeLanguage:
          'Approaches challenges by questioning assumptions and reframing problems to find solutions that better serve the intended purpose. Draws on personal experience and diverse perspectives to propose methods that are both practical and innovative.',
        talkingPoints: [
          'During a community needs assessment for sociology, I noticed that written surveys were a barrier for participants with limited literacy. I proposed using voice memos instead, drawing on how my grandmother communicates. The voice data was significantly richer than what written surveys produced.',
          'When midterm scheduling conflicted with my work shifts, I proposed a shift swap with another student employee that benefited both of us. I reframed the problem from needing help to solving something together.',
          'I\'m learning to question the way things are "supposed" to be done. Just because a method is standard doesn\'t mean it\'s the best approach for the situation at hand.',
        ],
      },
      {
        skillId: 'skill_critical_thinking',
        skillName: 'Critical Thinking',
        resumeLanguage:
          'Evaluates information carefully before acting on it and analyzes patterns in her own decision-making to continuously improve. Applies media literacy and self-reflection skills both in academic work and everyday situations.',
        talkingPoints: [
          'After a class on media literacy, I caught myself about to share a news article with unverified statistics on social media. I stopped, checked the sources, and decided not to share it. That moment showed me how easily misinformation spreads when we don\'t pause to verify.',
          'For a reflective essay, I analyzed three moments of adaptation across a quarter and identified patterns in how I respond to challenges. My professor praised the self-awareness, but the real value was learning to step back and examine my own thinking.',
        ],
      },
    ],
    version: 1,
  },
]
