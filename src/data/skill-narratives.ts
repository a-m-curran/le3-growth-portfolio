export interface DemoSkillNarrative {
  studentId: string
  skillId: string
  narrativeText: string
  narrativeRichness: 'thin' | 'developing' | 'rich'
  version: number
  /**
   * Optional sentence-to-conversation mapping for demo narratives.
   * Each entry's `sentence` must appear verbatim in `narrativeText`
   * (the renderer uses indexOf). Sentences here become inline links
   * to the source conversation in the v2 narrative view.
   */
  annotations?: Array<{ sentence: string; conversationId: string }>
}

/**
 * Each narrative's `annotations` array hand-maps specific sentences
 * in the prose to the conversation they were drawn from. The
 * v2 narrative view post-processes the narrative text, locating
 * each annotated sentence and rendering it as an inline button
 * that opens the source conversation in the ConversationPanel.
 *
 * For demo data we hand-annotate. In real mode, generating this
 * mapping is a post-processing LLM step that runs after the main
 * narrative generation and stores its output in the skill_narrative
 * row.
 *
 * Constraint: each `sentence` must be an exact substring of the
 * narrative text — the renderer uses indexOf to find and wrap it.
 */
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
    annotations: [
      { sentence: "You came to NLU with a definition of resilience that was all about toughness.", conversationId: 'conv_aja_01' },
      { sentence: "The turning point was the morning your childcare fell through.", conversationId: 'conv_aja_06' },
      { sentence: "It came after the writing center in October, when you chose help over dropping the class.", conversationId: 'conv_aja_02' },
      { sentence: "It came after organizing the study group in January, when you texted Keisha first because you needed one person to say yes before you could put yourself out there.", conversationId: 'conv_aja_05' },
      { sentence: "By the time you wrote your quarter synthesis, you had a new definition: resilience is knowing when to push through, when to ask for help, and how to learn from the times things don't go the way you planned.", conversationId: 'conv_aja_09' },
    ],
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
    annotations: [
      { sentence: "In January you organized a study group for MTH 150.", conversationId: 'conv_aja_05' },
      { sentence: "By the time you taught yourself Excel from YouTube and built an inventory system your manager never asked for, you didn't need permission at all.", conversationId: 'conv_aja_11' },
      { sentence: `You said it plainly: "I know I can figure stuff out if I try."`, conversationId: 'conv_aja_11' },
    ],
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
    annotations: [
      { sentence: "The shift swap during midterms is a good example.", conversationId: 'conv_aja_04' },
      { sentence: "But the moment that really showed this skill was the community survey redesign for SOC 155.", conversationId: 'conv_aja_09' },
    ],
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
    annotations: [
      { sentence: "You caught yourself scrolling at lunch, about to share a news article about childcare costs with unverified statistics.", conversationId: 'conv_aja_10' },
      { sentence: "You also showed this skill in your reflective essay, where your professor praised your self-awareness.", conversationId: 'conv_aja_07' },
    ],
  },

  // ─── AJA WILLIAMS — CURIOSITY ───────────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_curiosity',
    narrativeText: `You ask questions that other people skip over. Not because you're trying to impress anyone, but because you genuinely want to understand how things work beneath the surface.

It started showing up in small ways — asking "why" in class when everyone else was writing down the answer. But it's become something bigger. You dig into topics that aren't on the test, you follow threads that interest you even when they don't "count," and you've started bringing questions from one class into another.

The momentum is there. You're not just curious about the material anymore — you're curious about your own curiosity.`,
    narrativeRichness: 'developing',
    version: 1,
  },

  // ─── AJA WILLIAMS — EMPATHY ─────────────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_empathy',
    narrativeText: `You've always cared about people. But there's a difference between caring and understanding, and you're starting to see it.

In group work, you've moved from just being "nice" to actually trying to understand where your teammates are coming from. When someone pushes back on an idea, you pause now instead of getting defensive. That pause is new, and it matters.

You're building the kind of empathy that doesn't just feel — it listens.`,
    narrativeRichness: 'developing',
    version: 1,
  },

  // ─── AJA WILLIAMS — COMMUNICATION ───────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_communication',
    narrativeText: `The way you express yourself has shifted. Not louder — clearer.

Early on, you wrote to fill the page. Now your writing has a point, and you make it without hedging. In presentations, you've gone from reading slides to actually talking to the room.

You're starting to adjust how you communicate based on who you're talking to. That's a real skill, and it's one you're developing faster than you probably realize.`,
    narrativeRichness: 'developing',
    version: 1,
  },

  // ─── AJA WILLIAMS — ADAPTABILITY ────────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_adaptability',
    narrativeText: `Plans change. You used to fight that. Now you work with it.

When childcare fell through before your midterm, you didn't spiral — you called your professor before class and made a plan. When your group project data was unusable, you were the one who suggested pivoting. These aren't small things.

You're learning that flexibility isn't about giving up on what you want. It's about finding another way to get there.`,
    narrativeRichness: 'developing',
    version: 1,
  },

  // ─── AJA WILLIAMS — COLLABORATION ───────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_collaboration',
    narrativeText: `Working with other people used to stress you out. Not because you didn't want to — but because you didn't trust the process.

That's changing. You organized a study group when nobody else would. You stayed in a group project when it would have been easier to go solo. You're starting to see that the friction of collaboration is part of the learning.

You're not just participating anymore. You're contributing.`,
    narrativeRichness: 'developing',
    version: 1,
  },

  // ─── AJA WILLIAMS — NETWORKING ──────────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_networking',
    narrativeText: `You're starting to see connections as more than just contacts. The relationships you're building — with your professor at office hours, with the peer you're mentoring, with your supervisor at work — they're becoming part of how you navigate.

You don't just know people. You know how to show up for them.`,
    narrativeRichness: 'thin',
    version: 1,
  },

  // ─── AJA WILLIAMS — RELATIONSHIP BUILDING ────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_relationship_building',
    narrativeText: `Trust takes time. You know that now because you've lived it.

The study group you organized, the shift swap you negotiated, the mentoring you've done — these aren't transactions. They're relationships you've invested in. And they've invested back.

You're building a network that will hold you up when things get hard.`,
    narrativeRichness: 'developing',
    version: 1,
  },

  // ─── AJA WILLIAMS — SOCIAL AWARENESS ────────────
  {
    studentId: 'stu_aja',
    skillId: 'skill_social_awareness',
    narrativeText: `You notice things other people don't. The person who went quiet in the group meeting. The tension between the two people who aren't saying what they really think.

You're reading rooms better than you used to. And more importantly, you're using what you notice — not just observing, but responding. That awareness is becoming a strength.`,
    narrativeRichness: 'developing',
    version: 1,
  },
]
