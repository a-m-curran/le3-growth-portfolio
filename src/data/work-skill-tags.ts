export interface DemoWorkSkillTag {
  workId: string
  skillId: string
  confidence: number
  rationale: string
}

export const workSkillTags: DemoWorkSkillTag[] = [
  // ─── AJA WILLIAMS ─────────────────────────────────

  // work_aja_onboarding — Program Onboarding
  {
    workId: 'work_aja_onboarding',
    skillId: 'skill_resilience',
    confidence: 0.7,
    rationale: 'Onboarding reflection centered on resilience as endurance and not giving up, establishing a baseline definition.',
  },

  // work_aja_hum150_draft — HUM 150 First Draft
  {
    workId: 'work_aja_hum150_draft',
    skillId: 'skill_resilience',
    confidence: 0.85,
    rationale: 'Chose to go to the writing center instead of dropping the class when work shifts conflicted with the deadline.',
  },
  {
    workId: 'work_aja_hum150_draft',
    skillId: 'skill_initiative',
    confidence: 0.6,
    rationale: 'Sought out the writing center on her own rather than waiting for someone to suggest it.',
  },

  // work_aja_coach_checkin_f25 — Coach Check-In Reflection
  {
    workId: 'work_aja_coach_checkin_f25',
    skillId: 'skill_resilience',
    confidence: 0.75,
    rationale: 'Showed up to spaces where she felt she did not belong and reflected on the gap between self-perception and evidence.',
  },
  {
    workId: 'work_aja_coach_checkin_f25',
    skillId: 'skill_relationship_building',
    confidence: 0.6,
    rationale: 'Reflected on building a support network and connecting with peers like Keisha despite feelings of isolation.',
  },

  // work_aja_shift_swap — Work Schedule Shift Swap
  {
    workId: 'work_aja_shift_swap',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.85,
    rationale: 'Proposed a mutually beneficial shift swap that solved scheduling conflicts for both students during midterms.',
  },
  {
    workId: 'work_aja_shift_swap',
    skillId: 'skill_collaboration',
    confidence: 0.65,
    rationale: 'Framed the solution as a shared problem rather than an individual request, creating a win-win arrangement.',
  },

  // work_aja_study_group — Study Group Formation
  {
    workId: 'work_aja_study_group',
    skillId: 'skill_initiative',
    confidence: 0.85,
    rationale: 'Organized a study group for statistics without being prompted, stepping into a leadership role for the first time.',
  },
  {
    workId: 'work_aja_study_group',
    skillId: 'skill_collaboration',
    confidence: 0.7,
    rationale: 'Built a collaborative learning space that brought together 8 classmates for weekly study sessions.',
  },

  // work_aja_midterm_reschedule — Midterm Rescheduling
  {
    workId: 'work_aja_midterm_reschedule',
    skillId: 'skill_resilience',
    confidence: 0.9,
    rationale: 'Called her professor at 7am when childcare fell through, choosing to advocate for herself instead of giving up.',
  },
  {
    workId: 'work_aja_midterm_reschedule',
    skillId: 'skill_communication',
    confidence: 0.7,
    rationale: 'Communicated a difficult personal situation clearly and professionally to her professor under pressure.',
  },

  // work_aja_hum150_essay — Reflective Essay: Overcoming Barriers
  {
    workId: 'work_aja_hum150_essay',
    skillId: 'skill_critical_thinking',
    confidence: 0.8,
    rationale: 'Analyzed her own patterns of adaptation across three situations, demonstrating metacognitive awareness.',
  },
  {
    workId: 'work_aja_hum150_essay',
    skillId: 'skill_resilience',
    confidence: 0.75,
    rationale: 'Essay content traced her growth in handling obstacles, showing increasingly adaptive responses over the quarter.',
  },

  // work_aja_stats_retake — Stats Quiz Retake
  {
    workId: 'work_aja_stats_retake',
    skillId: 'skill_resilience',
    confidence: 0.88,
    rationale: 'Failed a quiz and went to office hours the same day, reframing the setback as information rather than judgment.',
  },
  {
    workId: 'work_aja_stats_retake',
    skillId: 'skill_curiosity',
    confidence: 0.7,
    rationale: 'Immediately sought to understand what she did not know, treating the failure as a learning opportunity.',
  },

  // work_aja_soc155_survey — Community Survey Redesign
  {
    workId: 'work_aja_soc155_survey',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.9,
    rationale: 'Connected her grandmother\'s voice messages to survey methodology, proposing voice memos for participants who struggle with written English.',
  },
  {
    workId: 'work_aja_soc155_survey',
    skillId: 'skill_empathy',
    confidence: 0.75,
    rationale: 'Recognized the barrier a written survey posed for a participant and centered the solution on accessibility and inclusion.',
  },

  // work_aja_news_analysis — News Article Analysis
  {
    workId: 'work_aja_news_analysis',
    skillId: 'skill_critical_thinking',
    confidence: 0.85,
    rationale: 'Caught herself about to share unverified statistics on social media and applied media literacy skills in real time.',
  },

  // work_aja_excel — Excel Self-Teaching for Work
  {
    workId: 'work_aja_excel',
    skillId: 'skill_curiosity',
    confidence: 0.85,
    rationale: 'Independently identified a workplace inefficiency and taught herself Excel from YouTube without anyone asking.',
  },
  {
    workId: 'work_aja_excel',
    skillId: 'skill_initiative',
    confidence: 0.8,
    rationale: 'Saw a problem at work and created a solution on her own time without prompting or permission from her manager.',
  },

  // work_aja_quarter_synthesis — Quarter Synthesis
  {
    workId: 'work_aja_quarter_synthesis',
    skillId: 'skill_resilience',
    confidence: 0.9,
    rationale: 'Synthesized a full year of growth, redefining resilience from endurance to honesty about what she needs.',
  },
  {
    workId: 'work_aja_quarter_synthesis',
    skillId: 'skill_critical_thinking',
    confidence: 0.65,
    rationale: 'Demonstrated sophisticated self-analysis by tracing patterns across three quarters of experience.',
  },

  // ─── AJA — UNREFLECTED WORK TAGS ──────────────────

  // work_aja_soc155_week3_discussion — Power Dynamics Discussion
  {
    workId: 'work_aja_soc155_week3_discussion',
    skillId: 'skill_social_awareness',
    confidence: 0.85,
    rationale: 'Analyzed informal power dynamics and unwritten rules in organizational culture.',
  },
  {
    workId: 'work_aja_soc155_week3_discussion',
    skillId: 'skill_critical_thinking',
    confidence: 0.75,
    rationale: 'Applied Schein\'s framework to identify gaps between stated and actual organizational values.',
  },

  // work_aja_soc155_network_analysis — Social Network Analysis
  {
    workId: 'work_aja_soc155_network_analysis',
    skillId: 'skill_collaboration',
    confidence: 0.8,
    rationale: 'Mapped collaborative networks and proposed structural solutions to improve cross-team communication.',
  },
  {
    workId: 'work_aja_soc155_network_analysis',
    skillId: 'skill_networking',
    confidence: 0.7,
    rationale: 'Identified key network connectors and proposed intentional relationship-building across organizational silos.',
  },

  // work_aja_workplace_conflict — Workplace Conflict
  {
    workId: 'work_aja_workplace_conflict',
    skillId: 'skill_communication',
    confidence: 0.85,
    rationale: 'Practiced and delivered a difficult conversation with her supervisor, proposing a solution alongside the concern.',
  },
  {
    workId: 'work_aja_workplace_conflict',
    skillId: 'skill_resilience',
    confidence: 0.65,
    rationale: 'Pushed through discomfort to advocate for herself in a power-imbalanced relationship.',
  },

  // work_aja_peer_feedback — Peer Feedback Exercise
  {
    workId: 'work_aja_peer_feedback',
    skillId: 'skill_empathy',
    confidence: 0.8,
    rationale: 'Navigated the tension between honesty and kindness in giving feedback, recognizing that vague praise isn\'t helpful.',
  },
  {
    workId: 'work_aja_peer_feedback',
    skillId: 'skill_communication',
    confidence: 0.7,
    rationale: 'Practiced delivering critical feedback constructively in a structured peer review setting.',
  },

  // work_aja_budget_proposal — Budget Proposal
  {
    workId: 'work_aja_budget_proposal',
    skillId: 'skill_initiative',
    confidence: 0.9,
    rationale: 'Independently identified a budget inefficiency and built a data-backed proposal without being asked.',
  },
  {
    workId: 'work_aja_budget_proposal',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.7,
    rationale: 'Reframed the budget question from "how do we spend the same" to "how do we match spending to actual demand."',
  },

  // work_aja_final_presentation — Final Presentation
  {
    workId: 'work_aja_final_presentation',
    skillId: 'skill_communication',
    confidence: 0.85,
    rationale: 'Delivered a presentation without notes for the first time, articulating organizational redesign recommendations to an audience.',
  },
  {
    workId: 'work_aja_final_presentation',
    skillId: 'skill_adaptability',
    confidence: 0.7,
    rationale: 'Proposed structural changes to an organization she works in, demonstrating flexibility in thinking about how systems can evolve.',
  },

  // ─── MARCUS CHEN ──────────────────────────────────

  // work_marcus_onboarding — Program Onboarding
  {
    workId: 'work_marcus_onboarding',
    skillId: 'skill_initiative',
    confidence: 0.6,
    rationale: 'Initial orientation establishing baseline skill definitions, with initiative as a natural strength.',
  },

  // work_marcus_volunteer — Tutoring Center Volunteer Setup
  {
    workId: 'work_marcus_volunteer',
    skillId: 'skill_initiative',
    confidence: 0.9,
    rationale: 'Created a peer tutoring program from scratch after overhearing struggling students, without being asked.',
  },
  {
    workId: 'work_marcus_volunteer',
    skillId: 'skill_empathy',
    confidence: 0.7,
    rationale: 'Responded to the needs of incoming students he overheard struggling, translating empathy into action.',
  },

  // work_marcus_group_project — BUS 200 Group Project Pivot
  {
    workId: 'work_marcus_group_project',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.85,
    rationale: 'Pivoted the team from unusable survey data to interview-based research by zooming out to the project\'s core purpose.',
  },
  {
    workId: 'work_marcus_group_project',
    skillId: 'skill_adaptability',
    confidence: 0.8,
    rationale: 'Led a major project direction change under deadline pressure, drawing on sports improvisation instincts.',
  },

  // work_marcus_comm_presentation — COMM 101 Final Presentation
  {
    workId: 'work_marcus_comm_presentation',
    skillId: 'skill_communication',
    confidence: 0.8,
    rationale: 'Delivered a presentation on community leadership despite significant stage fright, preparing extensively.',
  },
  {
    workId: 'work_marcus_comm_presentation',
    skillId: 'skill_resilience',
    confidence: 0.65,
    rationale: 'Overcame fear of public speaking through preparation rather than avoidance.',
  },

  // work_marcus_internship_app — Internship Application
  {
    workId: 'work_marcus_internship_app',
    skillId: 'skill_initiative',
    confidence: 0.8,
    rationale: 'Applied for a summer internship and taught himself web design to create a portfolio site for the application.',
  },
  {
    workId: 'work_marcus_internship_app',
    skillId: 'skill_curiosity',
    confidence: 0.75,
    rationale: 'Self-taught web design skills to strengthen his internship application without external guidance.',
  },

  // work_marcus_budget_tool — Student Organization Budget Tool
  {
    workId: 'work_marcus_budget_tool',
    skillId: 'skill_initiative',
    confidence: 0.88,
    rationale: 'Built a budget tracking spreadsheet for student government after noticing they tracked expenses on paper, without being asked.',
  },
  {
    workId: 'work_marcus_budget_tool',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.7,
    rationale: 'Identified an organizational inefficiency and created a practical digital solution to replace a paper-based system.',
  },

  // work_marcus_setback_paper — BUS 200 Midterm Paper
  {
    workId: 'work_marcus_setback_paper',
    skillId: 'skill_resilience',
    confidence: 0.8,
    rationale: 'Confronted his lowest grade and sat with the discomfort for two days, recognizing a gap in how he handles setbacks.',
  },

  // work_marcus_mentorship — Peer Mentorship Reflection
  {
    workId: 'work_marcus_mentorship',
    skillId: 'skill_empathy',
    confidence: 0.8,
    rationale: 'Mentored a first-year student through a difficult moment, drawing on his own experience with failure.',
  },
  {
    workId: 'work_marcus_mentorship',
    skillId: 'skill_relationship_building',
    confidence: 0.75,
    rationale: 'Built a meaningful informal mentoring relationship, investing time in another student\'s growth.',
  },

  // ─── SOFIA REYES ──────────────────────────────────

  // work_sofia_onboarding — Program Onboarding
  {
    workId: 'work_sofia_onboarding',
    skillId: 'skill_curiosity',
    confidence: 0.6,
    rationale: 'Initial orientation establishing baseline skill definitions, with curiosity as a natural driver.',
  },

  // work_sofia_art_project — ART 110 Mixed Media Project
  {
    workId: 'work_sofia_art_project',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.9,
    rationale: 'Combined photography with found objects in a way the professor called the most creative approach in the class.',
  },

  // work_sofia_bio_lab — BIO 120 Lab Report
  {
    workId: 'work_sofia_bio_lab',
    skillId: 'skill_critical_thinking',
    confidence: 0.85,
    rationale: 'Identified a contamination flaw in the lab procedure that nobody else noticed, prompting the TA to halt and adjust.',
  },
  {
    workId: 'work_sofia_bio_lab',
    skillId: 'skill_initiative',
    confidence: 0.7,
    rationale: 'Spoke up to the TA about the procedural flaw rather than staying silent, despite the social risk.',
  },

  // work_sofia_dropped_project — Abandoned Group Project
  {
    workId: 'work_sofia_dropped_project',
    skillId: 'skill_adaptability',
    confidence: 0.55,
    rationale: 'Adapted to a difficult group dynamic by requesting to work independently, though later recognized this as conflict avoidance.',
  },

  // work_sofia_research_pitch — Undergraduate Research Pitch
  {
    workId: 'work_sofia_research_pitch',
    skillId: 'skill_creative_problem_solving',
    confidence: 0.88,
    rationale: 'Pitched a research idea combining scientific illustration with biology data visualization, bridging art and science.',
  },
  {
    workId: 'work_sofia_research_pitch',
    skillId: 'skill_initiative',
    confidence: 0.8,
    rationale: 'Approached a professor with an unsolicited research proposal, taking a risk on an unconventional idea.',
  },

  // work_sofia_journal_analysis — Scientific Journal Analysis
  {
    workId: 'work_sofia_journal_analysis',
    skillId: 'skill_critical_thinking',
    confidence: 0.9,
    rationale: 'Identified three methodological issues in a published paper with critique more sophisticated than most graduate-level work.',
  },

  // work_sofia_team_return — Return to Group Work
  {
    workId: 'work_sofia_team_return',
    skillId: 'skill_resilience',
    confidence: 0.8,
    rationale: 'Rejoined a group project and stayed through disagreements after recognizing her pattern of conflict avoidance.',
  },
  {
    workId: 'work_sofia_team_return',
    skillId: 'skill_collaboration',
    confidence: 0.75,
    rationale: 'Chose to stay and work through disagreements with teammates instead of defaulting to solo work.',
  },
]
