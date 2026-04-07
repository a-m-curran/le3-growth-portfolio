export interface DemoSkillNarrative {
  studentId: string
  skillId: string
  narrativeText: string
  narrativeRichness: 'thin' | 'developing' | 'rich'
  version: number
}

export const skillNarratives: DemoSkillNarrative[] = [
  // ─── AJA WILLIAMS — RESILIENCE ────────────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_resilience',
    narrativeText: `You came to NLU with a definition of resilience that was all about toughness. Push through. Don't quit. Be strong like your mom. That was September. By June, you had rewritten that definition entirely — not because someone told you to, but because you lived your way into a new one.

The turning point was the morning your childcare fell through. You panicked for ten minutes and then you called your professor at 7am. That doesn't sound like a big deal on paper, but you know what it cost you. A few months earlier, you would have just not shown up. You would have eaten the loss quietly and been mad at yourself later. Instead you picked up the phone. You said it yourself: giving up is easy. Reaching out is the hard part.

That phone call didn't come out of nowhere. It came after the writing center in October, when you chose help over dropping the class. It came after organizing the study group in January, when you texted Keisha first because you needed one person to say yes before you could put yourself out there. Each time, the courage threshold got a little lower. Not because it got easier, but because you had evidence it worked.

By the time you wrote your quarter synthesis, you had a new definition: resilience is knowing when to push through, when to ask for help, and how to learn from the times things don't go the way you planned. It's not about being tough. It's about being honest with yourself about what you need. You earned every word of that.`,
    narrativeRichness: 'rich',
    version: 1,
  },

  // ─── AJA WILLIAMS — INITIATIVE ────────────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_initiative',
    narrativeText: `You don't think of yourself as someone who takes initiative. That's part of what makes it interesting — because you keep doing it anyway.

In January you organized a study group for MTH 150. You saw that everyone in class was struggling and nobody was doing anything about it. Your first thought was "who am I to organize something?" But you texted Keisha, and she said yes, and then you posted in the class group chat and eight people responded. You needed less permission than you expected. By the time you taught yourself Excel from YouTube and built an inventory system your manager never asked for, you didn't need permission at all. You just saw the problem and decided you could be the solution.

There's a trajectory here you noticed yourself: from needing your mom's words to walk into the writing center, to needing one text back from Keisha, to just doing it on your own at midnight after your daughter went to bed. The amount of courage you need keeps getting smaller. Not because the things are easier, but because you trust yourself more now. You said it plainly: "I know I can figure stuff out if I try." That's initiative — not waiting to be told, not waiting for permission. Just starting.`,
    narrativeRichness: 'rich',
    version: 1,
  },

  // ─── AJA WILLIAMS — CREATIVE PROBLEM SOLVING ─────
  {
    studentId: 'stu_aja',
    skillId: 'skill_creative_problem_solving',
    narrativeText: `You have a way of looking at problems that most people miss. You don't just solve them — you question the whole setup first.

The shift swap during midterms is a good example. You were sitting in the break room stressed about your schedule and Destiny was complaining about the same thing. Most people would have just kept complaining. You proposed a swap that helped both of you. What made it creative wasn't the idea itself — it was the reframe. You turned "I need help" into "we can solve this together." That felt different to you. Empowering instead of weak.

But the moment that really showed this skill was the community survey redesign for SOC 155. An older woman at the community center said she didn't read well, and you immediately connected that to your grandmother leaving voice messages instead of texts. You proposed voice memos instead of written surveys. Your group pushed back — "that's not how surveys work" — and you stood your ground. You said the point of the survey is to hear what people need, not to follow a format. The data from the first voice memo was richer than anything the written surveys had produced. You are learning to question the way things are "supposed" to be done, and to trust your own observations about what actually works.`,
    narrativeRichness: 'rich',
    version: 1,
  },

  // ─── AJA WILLIAMS — CRITICAL THINKING ────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_critical_thinking',
    narrativeText: `Your critical thinking shows up strongest when something is personal to you. That's not a weakness — it's a starting point.

You caught yourself scrolling at lunch, about to share a news article about childcare costs with unverified statistics. Something from your HUM 150 media literacy class clicked at exactly the right moment. You stopped. You checked. The article didn't cite anything. So you didn't share it. You've probably shared stuff like that a hundred times before. This time was different because the topic — childcare — mattered to you personally. When you care, your analytical brain turns on.

You also showed this skill in your reflective essay, where your professor praised your self-awareness. You laid out three moments of adaptation side by side and saw a pattern you hadn't noticed before. You called it "stepping back and looking at what I'm doing instead of just doing it." That's metacognition — thinking about your own thinking. It's not a skill most people develop this early.

The edge you identified yourself is real: you apply this lens more naturally when the topic is personal. The next step is learning to turn it on even when it doesn't feel personal yet. You already know you can do it. The question is whether you will.`,
    narrativeRichness: 'developing',
    version: 1,
  },
]
