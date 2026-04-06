-- LE3 Growth Portfolio — Seed Data
-- Deterministic UUIDs from string IDs using md5

-- ─── HELPER FUNCTION ────────────────────────────────

CREATE OR REPLACE FUNCTION str_to_uuid(input text) RETURNS uuid AS $$
  SELECT uuid_in(md5(input)::cstring);
$$ LANGUAGE sql IMMUTABLE;

-- ─── COACHES ────────────────────────────────────────

INSERT INTO coach (id, name, email, status) VALUES
  (str_to_uuid('coach_elizabeth'), 'Elizabeth Chen', 'echen@nlu.edu', 'active'),
  (str_to_uuid('coach_angelica'), 'Angelica Morales', 'amorales@nlu.edu', 'active');

-- ─── STUDENTS ───────────────────────────────────────

INSERT INTO student (id, nlu_id, first_name, last_name, email, coach_id, cohort, program_start_date, status) VALUES
  (str_to_uuid('stu_aja'), 'N00123456', 'Aja', 'Williams', 'awilliams@nlu.edu', str_to_uuid('coach_elizabeth'), 'Fall 2025', '2025-09-01', 'active'),
  (str_to_uuid('stu_marcus'), 'N00234567', 'Marcus', 'Chen', 'mchen@nlu.edu', str_to_uuid('coach_elizabeth'), 'Fall 2025', '2025-09-01', 'active'),
  (str_to_uuid('stu_sofia'), 'N00345678', 'Sofia', 'Reyes', 'sreyes@nlu.edu', str_to_uuid('coach_angelica'), 'Winter 2026', '2026-01-06', 'active');

-- ─── PILLARS ────────────────────────────────────────

INSERT INTO pillar (id, name, description, display_order) VALUES
  (str_to_uuid('pillar_creative'), 'Creative & Curious Mindset', 'Developing the ability to think creatively, critically, and independently', 1),
  (str_to_uuid('pillar_lead'), 'Lead Themselves & Others', 'Building resilience, initiative, and leadership capacity', 2),
  (str_to_uuid('pillar_thrive'), 'Thrive in Change', 'Adapting and growing through changing circumstances', 3);

-- ─── DURABLE SKILLS ─────────────────────────────────

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active) VALUES
  (str_to_uuid('skill_creative_problem_solving'), str_to_uuid('pillar_creative'), 'Creative Problem Solving', 'Approaching challenges from novel angles, questioning default approaches, combining ideas across domains', 1, true),
  (str_to_uuid('skill_critical_thinking'), str_to_uuid('pillar_creative'), 'Critical Thinking', 'Analyzing information carefully, questioning assumptions, evaluating evidence, distinguishing fact from opinion', 2, true),
  (str_to_uuid('skill_self_directed_learning'), str_to_uuid('pillar_creative'), 'Self-Directed Learning', 'Identifying learning needs, seeking resources independently, learning without external structure', 3, true),
  (str_to_uuid('skill_resilience'), str_to_uuid('pillar_lead'), 'Resilience', 'Navigating setbacks, adapting plans, seeking help when needed, recovering from failure, managing stress productively', 1, true),
  (str_to_uuid('skill_initiative'), str_to_uuid('pillar_lead'), 'Initiative', 'Acting without being prompted, creating opportunities, volunteering, proposing new approaches, stepping into leadership', 2, true);

-- ─── RUBRICS ────────────────────────────────────────

INSERT INTO rubric (id, skill_id, version, noticing_descriptors, practicing_descriptors, integrating_descriptors, evolving_descriptors, is_current) VALUES
  (str_to_uuid('rubric_cps'), str_to_uuid('skill_creative_problem_solving'), 1,
    '["Recognizes when a problem exists","Notices when standard approaches may not work","Begins to wonder about alternative methods"]'::jsonb,
    '["Actively looks for different ways to approach problems","Experiments with combining ideas from different sources","Tries at least one non-obvious solution before defaulting"]'::jsonb,
    '["Consistently generates novel approaches across different contexts","Draws connections between unrelated domains to solve problems","Helps others see problems from new angles"]'::jsonb,
    '["Creates frameworks for creative thinking that others adopt","Mentors peers in creative problem-solving approaches","Demonstrates innovative thinking as a natural habit"]'::jsonb,
    true),
  (str_to_uuid('rubric_ct'), str_to_uuid('skill_critical_thinking'), 1,
    '["Begins to question information rather than accepting it at face value","Notices when sources may be biased or incomplete","Starts distinguishing between opinion and evidence"]'::jsonb,
    '["Actively evaluates evidence before forming conclusions","Identifies assumptions in arguments and reasoning","Seeks out multiple perspectives on issues"]'::jsonb,
    '["Systematically analyzes complex information across contexts","Synthesizes contradictory evidence into nuanced positions","Teaches others to evaluate sources and reasoning"]'::jsonb,
    '["Models rigorous analytical thinking as a habit of mind","Creates structures that help communities think more critically","Navigates ambiguity with intellectual humility"]'::jsonb,
    true),
  (str_to_uuid('rubric_sdl'), str_to_uuid('skill_self_directed_learning'), 1,
    '["Recognizes when they need to learn something new","Notices gaps between what they know and what a task requires","Begins to seek help when stuck"]'::jsonb,
    '["Identifies specific learning goals and pursues them","Seeks out resources independently (tutorials, mentors, books)","Creates own study plans or learning routines"]'::jsonb,
    '["Learns complex skills across domains without external prompting","Builds learning into daily routines and work habits","Shares learning strategies with peers"]'::jsonb,
    '["Designs own learning pathways for professional growth","Mentors others in self-directed learning approaches","Demonstrates lifelong learning as a core identity"]'::jsonb,
    true),
  (str_to_uuid('rubric_res'), str_to_uuid('skill_resilience'), 1,
    '["Recognizes when they are experiencing a setback","Notices emotional responses to difficulty","Begins to distinguish between giving up and needing help"]'::jsonb,
    '["Actively uses strategies to manage setbacks","Seeks help when needed rather than isolating","Reframes failures as learning opportunities"]'::jsonb,
    '["Adapts plans fluidly when circumstances change","Balances self-reliance with knowing when to ask for support","Helps others navigate setbacks"]'::jsonb,
    '["Models resilient behavior for communities","Creates support structures for others facing adversity","Demonstrates growth through challenge as a consistent pattern"]'::jsonb,
    true),
  (str_to_uuid('rubric_init'), str_to_uuid('skill_initiative'), 1,
    '["Notices opportunities to contribute or act","Recognizes when something needs to be done","Begins to volunteer for tasks without being asked"]'::jsonb,
    '["Regularly takes action without waiting for direction","Proposes new ideas or improvements","Steps into leadership roles when needed"]'::jsonb,
    '["Consistently creates opportunities rather than waiting for them","Leads projects and initiatives across different contexts","Inspires initiative in others through example"]'::jsonb,
    '["Builds systems that encourage initiative in communities","Mentors emerging leaders","Demonstrates proactive leadership as a defining trait"]'::jsonb,
    true);

-- ─── STUDENT WORK ───────────────────────────────────

-- Aja
INSERT INTO student_work (id, student_id, title, description, work_type, course_name, course_code, submitted_at, quarter, week_number, content, grade) VALUES
  (str_to_uuid('work_aja_onboarding'), str_to_uuid('stu_aja'), 'Program Onboarding', 'Initial orientation and skill definition exercise', 'other', NULL, NULL, '2025-09-08T10:00:00Z', 'Fall 2025', 1, NULL, NULL),
  (str_to_uuid('work_aja_hum150_draft'), str_to_uuid('stu_aja'), 'HUM 150 First Draft', 'First draft of reflective essay while managing extra work shifts', 'essay', 'Humanities', 'HUM 150', '2025-10-06T14:00:00Z', 'Fall 2025', 2, 'Aja wrote about balancing her first major paper deadline with extra shifts at work. She almost dropped the class but went to the writing center instead.', NULL),
  (str_to_uuid('work_aja_coach_checkin_f25'), str_to_uuid('stu_aja'), 'Coach Check-In Reflection', 'Reflection on building a support network at NLU', 'other', NULL, NULL, '2025-10-20T11:00:00Z', 'Fall 2025', 4, 'Aja reflected on her tendency to isolate when stressed and discussed strategies for building a support network.', NULL),
  (str_to_uuid('work_aja_shift_swap'), str_to_uuid('stu_aja'), 'Work Schedule Shift Swap', 'Proposed creative shift swap arrangement during midterms', 'other', NULL, NULL, '2025-11-03T09:00:00Z', 'Fall 2025', 6, 'Aja proposed a shift swap with another student employee so both could have time during midterms. Manager approved the arrangement.', NULL),
  (str_to_uuid('work_aja_study_group'), str_to_uuid('stu_aja'), 'Study Group Formation', 'Started a study group for statistics class', 'other', 'Statistics', 'MTH 150', '2026-01-27T15:00:00Z', 'Winter 2026', 3, 'Aja organized a study group for MTH 150 stats. She felt weird being the one to organize it but the group has been meeting weekly.', NULL),
  (str_to_uuid('work_aja_midterm_reschedule'), str_to_uuid('stu_aja'), 'Midterm Rescheduling', 'Childcare fell through on midterm morning, called professor', 'other', NULL, NULL, '2026-02-17T08:00:00Z', 'Winter 2026', 7, 'Childcare fell through the morning of Aja''s midterm. She called her professor before class to explain the situation and arrange an alternative.', NULL),
  (str_to_uuid('work_aja_hum150_essay'), str_to_uuid('stu_aja'), 'Reflective Essay: Overcoming Barriers', 'Final reflective essay analyzing three moments of adaptation this quarter', 'essay', 'Humanities', 'HUM 150', '2026-02-24T16:00:00Z', 'Winter 2026', 8, 'Aja wrote about three moments this quarter where she had to adapt her plans. Her professor praised the self-awareness in her writing.', 'A-'),
  (str_to_uuid('work_aja_stats_retake'), str_to_uuid('stu_aja'), 'Stats Quiz Retake', 'Failed first attempt, went to office hours same day', 'exam', 'Statistics', 'MTH 150', '2026-03-10T14:00:00Z', 'Winter 2026', 10, 'Aja failed the stats quiz on Monday and went to office hours that same afternoon. Retook the quiz on Wednesday and passed.', 'B'),
  (str_to_uuid('work_aja_soc155_survey'), str_to_uuid('stu_aja'), 'Community Survey Redesign', 'Suggested voice memos instead of written surveys for SOC 155 project', 'project', 'Sociology', 'SOC 155', '2026-04-07T10:00:00Z', 'Spring 2026', 2, 'For the community needs assessment, Aja suggested using voice memos instead of written surveys to capture richer data from participants who struggle with written English.', NULL),
  (str_to_uuid('work_aja_news_analysis'), str_to_uuid('stu_aja'), 'News Article Analysis', 'Caught herself sharing unverified statistics on social media', 'essay', 'Humanities', 'HUM 150', '2026-04-21T13:00:00Z', 'Spring 2026', 4, 'After a class on media literacy, Aja caught herself almost sharing a news article with unverified statistics. She wrote about the experience.', NULL),
  (str_to_uuid('work_aja_excel'), str_to_uuid('stu_aja'), 'Excel Self-Teaching for Work', 'Learned Excel from YouTube for work tasks, manager noticed improvement', 'other', NULL, NULL, '2026-05-19T09:00:00Z', 'Spring 2026', 8, 'Aja taught herself Excel from YouTube tutorials to handle inventory tracking at work. Her manager noticed the improvement and gave her more responsibility.', NULL),
  (str_to_uuid('work_aja_quarter_synthesis'), str_to_uuid('stu_aja'), 'Quarter Synthesis', 'End-of-quarter self-assessment and definition revisions', 'portfolio_piece', NULL, NULL, '2026-06-02T16:00:00Z', 'Spring 2026', 11, 'Aja completed her quarterly self-assessment and revised her definition of Resilience.', NULL);

-- Marcus
INSERT INTO student_work (id, student_id, title, description, work_type, course_name, course_code, submitted_at, quarter, week_number, content, grade) VALUES
  (str_to_uuid('work_marcus_onboarding'), str_to_uuid('stu_marcus'), 'Program Onboarding', 'Initial orientation and skill definitions', 'other', NULL, NULL, '2025-09-08T10:00:00Z', 'Fall 2025', 1, NULL, NULL),
  (str_to_uuid('work_marcus_volunteer'), str_to_uuid('stu_marcus'), 'Tutoring Center Volunteer Setup', 'Organized a peer tutoring program for incoming students', 'project', NULL, NULL, '2025-10-13T11:00:00Z', 'Fall 2025', 3, 'Marcus noticed incoming students struggling and organized a peer tutoring program without being asked. Got 5 volunteers.', NULL),
  (str_to_uuid('work_marcus_group_project'), str_to_uuid('stu_marcus'), 'BUS 200 Group Project Pivot', 'Led team through a major project direction change', 'project', 'Business Fundamentals', 'BUS 200', '2025-11-10T14:00:00Z', 'Fall 2025', 7, 'Marcus''s group project hit a wall when their survey data was unusable. He proposed pivoting to interview-based research and led the team through the transition.', 'A'),
  (str_to_uuid('work_marcus_comm_presentation'), str_to_uuid('stu_marcus'), 'COMM 101 Final Presentation', 'Presented on community leadership, overcame stage fright', 'presentation', 'Communications', 'COMM 101', '2025-12-01T10:00:00Z', 'Fall 2025', 10, 'Marcus presented on community leadership. He was terrified of public speaking but prepared extensively and used note cards.', 'B+'),
  (str_to_uuid('work_marcus_internship_app'), str_to_uuid('stu_marcus'), 'Internship Application', 'Applied to summer internship, created own portfolio website', 'project', NULL, NULL, '2026-02-03T09:00:00Z', 'Winter 2026', 4, 'Marcus applied for a summer internship and taught himself basic web design to create a portfolio site for the application.', NULL),
  (str_to_uuid('work_marcus_budget_tool'), str_to_uuid('stu_marcus'), 'Student Organization Budget Tool', 'Built a budgeting spreadsheet for the student government', 'project', NULL, NULL, '2026-03-03T15:00:00Z', 'Winter 2026', 8, 'Marcus built a budget tracking spreadsheet for student government after noticing they were tracking expenses on paper. Nobody asked him to do it.', NULL),
  (str_to_uuid('work_marcus_setback_paper'), str_to_uuid('stu_marcus'), 'BUS 200 Midterm Paper', 'Received lowest grade of the quarter, had to process the setback', 'essay', 'Business Fundamentals', 'BUS 200', '2026-02-24T14:00:00Z', 'Winter 2026', 7, 'Marcus got a C on his midterm paper — his lowest grade. He was used to leading and succeeding.', 'C'),
  (str_to_uuid('work_marcus_mentorship'), str_to_uuid('stu_marcus'), 'Peer Mentorship Reflection', 'Reflected on mentoring a first-year student through a difficult transition', 'other', NULL, NULL, '2026-04-14T11:00:00Z', 'Spring 2026', 3, 'Marcus has been informally mentoring a first-year student who reminds him of himself. Reflected on what he''s learned from the experience.', NULL);

-- Sofia
INSERT INTO student_work (id, student_id, title, description, work_type, course_name, course_code, submitted_at, quarter, week_number, content, grade) VALUES
  (str_to_uuid('work_sofia_onboarding'), str_to_uuid('stu_sofia'), 'Program Onboarding', 'Initial orientation and skill definitions', 'other', NULL, NULL, '2026-01-13T10:00:00Z', 'Winter 2026', 1, NULL, NULL),
  (str_to_uuid('work_sofia_art_project'), str_to_uuid('stu_sofia'), 'ART 110 Mixed Media Project', 'Combined photography with found objects for art assignment', 'project', 'Art Foundations', 'ART 110', '2026-01-27T14:00:00Z', 'Winter 2026', 3, 'Sofia combined photography with found objects for her art project. Professor called it the most creative approach in the class.', 'A'),
  (str_to_uuid('work_sofia_bio_lab'), str_to_uuid('stu_sofia'), 'BIO 120 Lab Report', 'Identified flaw in lab procedure, proposed improvement', 'lab_report', 'Biology', 'BIO 120', '2026-02-10T16:00:00Z', 'Winter 2026', 5, 'During a lab, Sofia noticed the procedure had a potential contamination issue. She raised it with the TA and suggested a modification.', NULL),
  (str_to_uuid('work_sofia_dropped_project'), str_to_uuid('stu_sofia'), 'Abandoned Group Project', 'Left a group project when conflict arose with teammates', 'project', 'Sociology', 'SOC 100', '2026-02-24T10:00:00Z', 'Winter 2026', 7, 'Sofia left her group project after a disagreement about the direction. She asked the professor to work alone instead.', NULL),
  (str_to_uuid('work_sofia_research_pitch'), str_to_uuid('stu_sofia'), 'Undergraduate Research Pitch', 'Pitched a research idea to a professor, combining art and science', 'presentation', 'Biology', 'BIO 120', '2026-03-17T11:00:00Z', 'Winter 2026', 10, 'Sofia pitched an undergraduate research idea that combined scientific illustration with biology data visualization. The professor was intrigued.', NULL),
  (str_to_uuid('work_sofia_journal_analysis'), str_to_uuid('stu_sofia'), 'Scientific Journal Analysis', 'Analyzed methodology flaws in a published paper', 'essay', 'Biology', 'BIO 120', '2026-04-07T14:00:00Z', 'Spring 2026', 2, 'Sofia analyzed a published paper and identified three methodological issues. Her critique was more sophisticated than most graduate-level work.', 'A+'),
  (str_to_uuid('work_sofia_team_return'), str_to_uuid('stu_sofia'), 'Return to Group Work', 'Rejoined a team project after working through conflict avoidance', 'project', 'Sociology', 'SOC 100', '2026-04-21T10:00:00Z', 'Spring 2026', 4, 'After coaching conversations, Sofia rejoined a group project. This time she stayed when disagreements arose.', NULL);

-- ─── GROWTH CONVERSATIONS ───────────────────────────

-- conv_aja_01: Onboarding (Fall Wk 1)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_01'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_onboarding'), 'Fall 2025', 1, 'completed', '2025-09-08T10:30:00Z', '2025-09-08T11:00:00Z', 1800,
    'Aja completed her initial program onboarding and wrote her first definitions for all 5 durable skills.',
    'Welcome to the LE3 Growth Portfolio, Aja. Before we dive into your coursework, I''d like to get to know how you think about some important skills. Let''s start simple: when you hear the word ''resilience,'' what comes to mind from your own life?',
    'I guess resilience means being strong enough to not give up when things get hard. Like my mom — she''s been through a lot and she just keeps going no matter what. I want to be like that. Just push through.',
    'You mentioned your mom — someone who ''keeps going no matter what.'' You used the word ''push through'' twice. What does pushing through actually look like for you day to day?',
    'Honestly it looks like staying up late to finish things even when I''m exhausted. Or going to class even when I don''t feel like it. Just not quitting I guess. I''ve quit a lot of things before coming here and I don''t want to do that anymore.',
    'You said you''ve quit a lot of things before and you don''t want to do that anymore. That sounds like coming to NLU was a deliberate choice to break a pattern. What made this time different?',
    'My daughter. I want her to see me finish something. And I think I''m tired of starting over. Every time I quit something I have to start from scratch somewhere else and that''s exhausting too. At least here I know where I''m going.',
    'You came to NLU with a clear purpose: to finish something, for yourself and for your daughter. Your idea of strength right now is about not quitting — pushing through no matter what. That''s a powerful starting point.',
    'Baseline: resilience defined as ''pushing through'' and ''not quitting'' — strength as endurance');

-- conv_aja_02: HUM 150 Draft (Fall Wk 2)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_02'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_hum150_draft'), 'Fall 2025', 2, 'completed', '2025-10-06T14:30:00Z', '2025-10-06T14:52:00Z', 1320,
    'Aja submitted her first draft for HUM 150 this week while managing extra work shifts.',
    'You turned in your HUM 150 draft this week — but I know it wasn''t straightforward. You had extra shifts at work at the same time. Walk me through how you managed both.',
    'Honestly I almost didn''t turn it in. Work scheduled me for extra shifts right during the week it was due and I was so stressed I almost just dropped the class. But I went to the writing center and got help on my paper so I could manage both. It wasn''t my best work but I turned it in.',
    'You said you almost dropped the class. That''s a big thing to almost do. What happened between ''I''m going to drop it'' and going to the writing center instead?',
    'I think I just got tired of giving up on stuff. Like every time something gets hard I bail and then I''m mad at myself later. This time I was like, okay what if I just tried getting help first. The writing center was actually really helpful, they didn''t judge me for being behind.',
    'You said something I want to come back to: ''I got tired of giving up on stuff.'' That sounds like you noticed a pattern in yourself and decided to do something different. When did you start noticing that pattern?',
    'Probably this summer honestly. I kept starting things and not finishing them and my mom said something about it that stuck with me. She wasn''t mean about it but she was right. Coming to NLU was supposed to be different. So when the work thing happened I remembered that feeling.',
    'You''re learning to catch yourself in a moment where your old pattern would be to bail — and choosing differently. Going to the writing center wasn''t just about the paper. It was about proving to yourself that this time is different.',
    'Pattern: choosing to get help instead of giving up when things get hard');

-- conv_aja_03: Coach Check-In (Fall Wk 4)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_03'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_coach_checkin_f25'), 'Fall 2025', 4, 'completed', '2025-10-20T11:15:00Z', '2025-10-20T11:38:00Z', 1380,
    'Aja had a coaching session and reflected on building a support network.',
    'Your coach mentioned you talked about feeling alone at NLU — like you''re the only one dealing with certain things. Tell me about a moment this week where that feeling came up.',
    'Yeah it was Wednesday. Everyone in my study group was talking about their weekends and I was just sitting there thinking I spent my whole weekend doing laundry and watching my daughter. I felt like I don''t belong here sometimes. Like everyone else has it easier.',
    'You said ''I don''t belong here sometimes.'' But you were sitting in the study group. You showed up. What made you stay instead of leaving?',
    'I don''t know honestly. I guess I stayed because leaving would''ve been weird? But also because the girl next to me — Keisha — she asked me something about the homework and I actually knew the answer. That felt good. Like maybe I do know what I''m doing sometimes.',
    'You stayed, and Keisha asked you for help, and you knew the answer. There''s a pattern forming: the writing center two weeks ago, this study group now. You keep showing up to spaces where you''re not sure you belong, and then discovering you do. What do you make of that?',
    'Huh. I didn''t think about it that way. I guess I keep expecting to be the one who doesn''t know anything and then it turns out I do? It''s weird. Like my brain tells me I don''t belong but the evidence keeps saying otherwise.',
    'You keep showing up to spaces where you expect to feel out of place — and then finding out you belong there. Your brain says one thing, but the evidence says another. Noticing that gap is a big deal.',
    'Recognition: gap between self-perception (''I don''t belong'') and evidence (''I knew the answer'')');

-- conv_aja_04: Shift Swap (Fall Wk 6)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_04'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_shift_swap'), 'Fall 2025', 6, 'completed', '2025-11-03T09:30:00Z', '2025-11-03T09:52:00Z', 1320,
    'Aja proposed a creative shift swap arrangement with a coworker during midterms.',
    'You came up with a plan to swap shifts with another student employee during midterms. Walk me through how that idea came about — like, where were you when you thought of it?',
    'I was literally sitting in the break room at work stressing about my schedule and this other girl Destiny was complaining about the same thing. And I was like wait, what if we just swapped? Like she could take my Tuesday shifts and I''d take her Thursday shifts and we''d both have time to study. I just asked my manager and she said yes.',
    'You said ''I just asked my manager.'' Like it was simple. But last month asking for help felt impossible — you almost dropped a class instead. What''s different now about asking?',
    'Oh wow. I didn''t even think about that. I guess with the shift swap it didn''t feel like asking for help? It felt more like solving a problem. Like I wasn''t admitting weakness, I was being smart about it. And Destiny got something out of it too so it wasn''t just me needing something.',
    'You made a distinction just now: asking for help feels like ''admitting weakness,'' but proposing a swap felt like ''being smart about it.'' Both involve reaching out to someone else. But one feels harder than the other. What do you notice about that?',
    'I think... when I''m the one who comes up with the idea it feels different? Like if I go to the writing center I''m admitting I can''t do it alone. But if I propose a swap I''m the one solving the problem. It''s the same thing kind of but it feels totally different in my head.',
    'You found a creative way to solve the midterm scheduling crunch by proposing a swap that helped both you and Destiny. You''re starting to notice that reaching out feels different depending on whether you frame it as asking for help or solving a problem together.',
    'Shift: reframing ''asking for help'' as ''solving a problem together'' makes reaching out feel empowering instead of weak');

-- conv_aja_05: Study Group (Winter Wk 3)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_05'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_study_group'), 'Winter 2026', 3, 'completed', '2026-01-27T15:30:00Z', '2026-01-27T15:55:00Z', 1500,
    'Aja started a study group for statistics class.',
    'You started a study group for MTH 150 this month. That''s interesting because last quarter you were the one joining groups and wondering if you belonged. What prompted you to be the one who organized it this time?',
    'Stats is so hard and I could tell everyone in class was struggling but nobody was doing anything about it. I remembered how helpful the study group was for HUM 150 and I was like, somebody should start one for stats. And then I realized I could just be that somebody. It felt weird though, like who am I to organize something?',
    'You said ''who am I to organize something?'' but you did it anyway. What happened between that thought and actually sending the group text or however you got people together?',
    'I texted Keisha first because I knew she''d say yes. And once one person said yes it felt less scary. Then I posted in our class group chat and like 8 people responded. I think I just needed one person to validate that it wasn''t a dumb idea before I could put myself out there for real.',
    'There''s something interesting here. Last quarter you went to the writing center alone. Then you stayed in a study group someone else organized. Now you''re the one organizing. And each time, you needed less — first it was your mom''s words, then Keisha knowing the answer, now just one text back from Keisha. Does that trajectory feel real to you?',
    'Yeah actually it does. Like the amount of courage I need keeps getting smaller? Not because the things are easier but because I''ve done it before and it worked out. That''s kind of cool actually. I never thought about it as a trajectory before.',
    'You went from needing your mom''s push to walk into the writing center, to needing one text from Keisha to organize a study group for eight people. The courage threshold is getting lower — not because it''s easier, but because you have evidence it works.',
    'Pattern: decreasing courage threshold for reaching out — each successful attempt lowers the barrier for the next one');

-- conv_aja_06: Midterm Rescheduling (Winter Wk 7)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_06'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_midterm_reschedule'), 'Winter 2026', 7, 'completed', '2026-02-17T10:00:00Z', '2026-02-17T10:25:00Z', 1500,
    'Childcare fell through on the morning of Aja''s midterm.',
    'Your childcare fell through on midterm morning. That''s a nightmare scenario. Walk me through that morning — not the logistics, but the moment you realized what was happening and had to decide what to do.',
    'I panicked for like 10 minutes and then I just called my professor. I almost didn''t because I thought she''d think I was making excuses. Like who calls their professor at 7am? But I did it and she was actually really understanding. She let me take it the next day.',
    'You said you almost didn''t call because you thought she''d think you were making excuses. But you called anyway. What shifted between ''I almost didn''t'' and actually picking up the phone?',
    'I think I just realized that not calling was actually the easier thing. Like giving up is easy. Asking for help is the hard part. And I''ve been practicing the hard part I guess? Like with the writing center and the study group. This was just a bigger version of the same thing.',
    'You just said something really specific: ''giving up is easy, asking for help is the hard part.'' That''s the third time this year you''ve described reaching out as harder than going it alone. In October it was the writing center. In January it was organizing the study group. Now this. What do you notice about that pattern?',
    'I''m starting to see it as a pattern yeah. Like my instinct is always to handle it alone or just give up. But I keep choosing the harder thing which is reaching out. And every time it works out better than I expected. I think reaching out isn''t weakness — it''s actually the harder, braver thing to do.',
    'You named something important today: reaching out isn''t the easy way out — it''s the harder, braver choice. And you''ve been making that choice more consistently. From the writing center in October, to the study group in January, to calling your professor at 7am today.',
    'Shift: reframing help-seeking from weakness to courage — ''reaching out isn''t weakness, it''s the harder, braver thing to do''');

-- conv_aja_07: HUM 150 Essay (Winter Wk 8)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_07'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_hum150_essay'), 'Winter 2026', 8, 'completed', '2026-02-24T16:30:00Z', '2026-02-24T16:55:00Z', 1500,
    'Aja wrote a reflective essay analyzing three moments of adaptation this quarter. Her professor praised the self-awareness.',
    'Your professor gave you an A- on your reflective essay and specifically mentioned your self-awareness. You wrote about three moments where you had to adapt. What was it like writing about those moments?',
    'It was actually really emotional. I didn''t expect that. Like when I was writing about the childcare thing I started crying because I realized how far I''d come from the beginning of the year. Back then I would''ve just not shown up and not told anyone. Now I call my professor at 7am. That''s a completely different person.',
    'You said ''that''s a completely different person.'' But it''s still you — same person, different choices. When did you start recognizing that the changes were adding up?',
    'I think writing the essay is when it clicked? Like I had to list out the three moments and when I saw them side by side I was like oh, there''s a pattern here. I''m not just reacting to problems anymore, I''m actually thinking about how to handle them. That''s new for me.',
    'You went from reacting to thinking. And you noticed that shift by writing about it — the essay itself was how you saw the pattern. Your professor noticed your self-awareness, but here''s what I notice: you''re doing the same thing right now that you described in the essay. Reflecting on reflection. Does that make sense?',
    'Yeah it does. Like I''m getting better at stepping back and looking at what I''m doing instead of just doing it? I think that''s what my professor meant by self-awareness. It''s not just knowing yourself, it''s watching yourself and learning from it. I don''t know if I''m saying that right.',
    'Writing the essay was the moment you saw the pattern clearly — three moments of adaptation laid out side by side. You''re learning to step back and watch yourself, not just react. Your professor called it self-awareness. You''re calling it ''watching yourself and learning from it.'' Both are right.',
    'Recognition: metacognitive awareness emerging — ''stepping back and looking at what I''m doing instead of just doing it''');

-- conv_aja_08: Stats Quiz Retake (Winter Wk 10)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_08'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_stats_retake'), 'Winter 2026', 10, 'completed', '2026-03-10T14:30:00Z', '2026-03-10T14:50:00Z', 1200,
    'Aja failed her stats quiz and went to office hours the same day.',
    'You failed the stats quiz on Monday and were in office hours that same afternoon. That''s a fast turnaround. Tell me about the time between seeing the grade and walking into office hours.',
    'I saw the grade on my phone between classes and my first thought was ''I''m so stupid.'' Like that''s always my first thought. But then I was like wait, I''m not stupid, I just don''t understand this specific thing yet. So I looked up when office hours were and just went. I didn''t even think about it that hard.',
    'You caught yourself mid-thought — ''I''m so stupid'' turned into ''I just don''t understand this yet.'' That''s a really specific internal shift. Where did that come from?',
    'I think it''s from that essay I wrote? Where I realized I was changing? Like I know now that my first reaction isn''t always the right one. My first reaction to the childcare thing was to not call. My first reaction to the quiz was ''I''m stupid.'' But I''ve learned that my second reaction is usually better. The setback is just information, not a judgment on who I am.',
    'You just said ''the setback is just information, not a judgment.'' That''s a very different framing from September when you defined resilience as ''pushing through no matter what.'' Pushing through is about endurance. ''Setbacks as information'' is about learning. Do you notice that shift?',
    'Wow. Yeah. I don''t think I thought about resilience as learning before? I thought it was just about being tough. But being tough didn''t help me pass the quiz. Going to office hours did. So maybe resilience isn''t about toughness, it''s about what you do with the information.',
    'You caught your own first reaction — ''I''m stupid'' — and replaced it with ''I don''t understand this yet.'' Then you went straight to office hours. You''re reframing setbacks as information rather than judgments. That''s a shift from ''push through'' to ''learn from.''',
    'Shift: resilience reframed from endurance (''pushing through'') to learning (''setbacks as information, not judgment'')');

-- conv_aja_09: SOC 155 Survey (Spring Wk 2)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_09'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_soc155_survey'), 'Spring 2026', 2, 'completed', '2026-04-07T10:30:00Z', '2026-04-07T10:55:00Z', 1500,
    'Aja suggested voice memos instead of written surveys for the SOC 155 community needs assessment.',
    'Your SOC 155 group was doing a community needs assessment with written surveys. You suggested switching to voice memos. Where did that idea come from?',
    'So we were at the community center trying to get people to fill out surveys and this older woman was like ''I don''t read so good.'' And I could see she had a lot to say but the paper was a barrier. And I thought about how my grandma always leaves voice messages instead of texting. So I was like, what if we just let people talk?',
    'You connected your grandmother''s voice messages to a survey methodology. That''s a pretty big creative leap. What happened in your group when you suggested it?',
    'At first they were like ''that''s not how surveys work'' and I almost backed down. But then I was like no, the point of the survey is to hear what people need, not to follow a format. So I showed them how you could record on a phone and we tried it with the next person and she talked for like 5 minutes. The data was so much richer.',
    'You stood your ground when the group pushed back. And your reasoning wasn''t ''I have a better idea'' — it was ''the point of the survey is to hear people.'' You centered the purpose over the format. You did something similar with the shift swap last quarter — you solved a problem by questioning the default approach. What do you notice?',
    'I think I''m getting better at questioning the way things are ''supposed'' to be done? Like just because everyone does surveys on paper doesn''t mean that''s the best way. And I used to just go along with how things were done because I figured other people knew better. But sometimes they''re just doing it that way because that''s how it''s always been done.',
    'You saw a barrier — a written survey for someone who struggles with reading — and found a creative solution by connecting it to something from your own life. You''re learning to question default approaches and trust your own observations about what actually works.',
    'Pattern: questioning default approaches by centering purpose over format — trust in own observations growing');

-- conv_aja_10: News Article Analysis (Spring Wk 4)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_10'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_news_analysis'), 'Spring 2026', 4, 'completed', '2026-04-21T13:30:00Z', '2026-04-21T13:52:00Z', 1320,
    'Aja caught herself almost sharing a news article with unverified statistics after a class on media literacy.',
    'You wrote about catching yourself almost sharing a news article with questionable statistics. Tell me about that moment — where were you, what were you doing?',
    'I was scrolling my phone at lunch and saw this article about childcare costs and I was about to share it because the numbers were wild. But then I remembered what we talked about in class about checking sources and I was like wait, where did these numbers come from? And the article didn''t cite anything. So I didn''t share it.',
    'You said ''I remembered what we talked about in class.'' The class material kicked in at the exact right moment — when you were about to act on unverified information. What was it like to catch yourself?',
    'It was kind of eye-opening honestly. Like I''ve probably shared stuff like that a hundred times without thinking about it. But this time something clicked and I was like hold on. I think it''s because the topic was childcare and that''s personal to me? So I cared more about whether it was actually true.',
    'You noticed that caring about the topic made you more careful — when it''s personal, you applied the critical lens more naturally. That''s interesting because a lot of what you''ve been doing this year has been personal: your daughter motivating you, your own schedule driving creative solutions, your own failure driving you to office hours. When something matters to you, you think harder about it. What do you make of that?',
    'I think that''s true. Like when I care about something I actually engage my brain instead of just reacting. The hard part is caring about stuff that doesn''t feel personal yet. Like I probably wouldn''t have checked the statistics if it was about something I don''t care about. But maybe that''s something I can work on.',
    'You caught yourself before sharing unverified information — and noticed that you applied critical thinking more naturally when the topic was personal. You''re starting to see that your analytical brain turns on when you care. The next edge is learning to turn it on even when it doesn''t feel personal.',
    'Recognition: critical thinking activates more naturally when topic is personally relevant — identified the edge of extending it to less personal domains');

-- conv_aja_11: Excel Self-Teaching (Spring Wk 8)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_11'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_excel'), 'Spring 2026', 8, 'completed', '2026-05-19T09:30:00Z', '2026-05-19T09:55:00Z', 1500,
    'Aja taught herself Excel from YouTube to handle inventory tracking at work.',
    'Your manager at work mentioned that you''ve been handling inventory tracking differently. You taught yourself Excel from YouTube. Walk me through what prompted that — the moment you decided to learn it.',
    'My manager was doing everything on paper and it was always getting lost or messed up. And I was watching her struggle with it and I was like, there has to be a better way. So I went on YouTube one night after my daughter went to bed and just started learning Excel. It took me like three nights but I made a spreadsheet that actually works.',
    'You said ''there has to be a better way'' and then you went and found it yourself, on your own time, without anyone asking. Last quarter you needed Keisha to text back before you could start the study group. This time you just... did it. What was different?',
    'Honestly I didn''t even think about it. I just saw a problem and was like, I bet I can figure this out. I didn''t need permission or validation or anything. I just did it. I think... I think I trust myself more now? Like I know I can figure stuff out if I try.',
    'You just said ''I trust myself more now.'' In September, you defined self-directed learning as ''teaching yourself things.'' But what you did with Excel was more than that — you saw a need, decided you were the person to solve it, and learned a new skill without anyone prompting you. Your manager didn''t ask for a spreadsheet. You created something that didn''t exist. Does ''teaching yourself things'' still capture what you''re doing?',
    'No, I think it''s bigger than that now. It''s not just about learning things, it''s about seeing what needs to happen and then going and figuring out how to make it happen. Nobody told me to learn Excel. I just saw the problem and decided I could be the solution. That''s different from just watching tutorials.',
    'You saw a problem at work that nobody asked you to fix, taught yourself a new tool, and created something that changed how your workplace operates. You''re not just learning for yourself anymore — you''re learning to create change. That''s a shift from ''teaching yourself things'' to ''seeing what needs to happen and making it happen.''',
    'Shift: self-directed learning evolving from ''teaching yourself things'' to ''seeing needs and creating solutions independently''');

-- conv_aja_12: Quarter Synthesis (Spring Wk 11)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_aja_12'), str_to_uuid('stu_aja'), str_to_uuid('work_aja_quarter_synthesis'), 'Spring 2026', 11, 'completed', '2026-06-02T16:00:00Z', '2026-06-02T16:30:00Z', 1800,
    'End of quarter self-assessment and definition revision for Resilience.',
    'It''s the end of your third quarter at NLU. You''ve had 11 growth conversations now. When you look back at where you started in September, what stands out most?',
    'I think the biggest thing is that I actually stayed. Like that sounds basic but in September I wasn''t sure I would make it through the first quarter. And now I''m finishing my third. But it''s not just that I stayed — it''s how I stayed. I stopped trying to do everything alone.',
    'You said ''I stopped trying to do everything alone.'' That''s a pretty clear self-assessment. Can you point to the specific moment or conversation where that shift became real for you?',
    'The midterm morning. When I called my professor at 7am. That was the moment where I was like, okay, I actually believe that asking for help is the right thing to do, not just something I have to do because I have no other choice. Before that I was doing it but I didn''t fully believe it. That morning I chose it.',
    'Your definition of resilience from September was ''being strong enough to not give up when things get hard — pushing through no matter what.'' You''ve spent three quarters learning that resilience looks different than pushing through. Would you define it differently now?',
    'Yeah. Resilience is knowing when to push through, when to ask for help, and how to learn from times things don''t go the way I planned. It''s not about being tough — it''s about being honest with yourself about what you need. That''s what I''d say now.',
    'Three quarters in, you''ve transformed your understanding of resilience from ''pushing through no matter what'' to ''being honest with yourself about what you need.'' The shift happened through lived experience — writing centers, study groups, 7am phone calls, office hours. Each one built on the last.',
    'Shift: complete resilience redefinition — from ''pushing through'' to ''honesty about needs'' — driven by accumulated experience across 11 conversations');

-- conv_marcus_01: Tutoring Center Volunteer (Fall Wk 3)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_marcus_01'), str_to_uuid('stu_marcus'), str_to_uuid('work_marcus_volunteer'), 'Fall 2025', 3, 'completed', '2025-10-13T11:30:00Z', '2025-10-13T11:55:00Z', 1500,
    'Marcus organized a peer tutoring program for incoming students.',
    'You set up a peer tutoring program — got 5 volunteers, organized schedules, the whole thing. Nobody asked you to do this. Tell me about the moment you decided ''I should be the one to do this.''',
    'I was in the library and I overheard these two first-years talking about how lost they were in their math class. And I just thought, I know this stuff, I could help. I used to tutor in high school. So I put up a sign-up sheet and it just kind of happened. I don''t think I decided as much as I just started doing it.',
    'You said ''I don''t think I decided as much as I just started doing it.'' That''s interesting — like initiative for you isn''t a big deliberate choice, it''s just what you naturally do. Is that how it feels?',
    'Yeah actually. I see a need and I fill it. My mom always says I''ve been like that since I was a kid — organizing the neighborhood kids, setting things up. I don''t think of it as special, it''s just what I do. But I guess not everyone does that?',
    'You see a need and you fill it — and it feels so natural you don''t think of it as a skill. But here''s what''s interesting: you organized 5 volunteers, created a schedule, and launched something from scratch in a week. That''s not nothing. What would you say to a first-year student who sees a need but doesn''t know how to start?',
    'I''d tell them to just start. Like don''t wait for someone to give you permission. If you see something that needs to happen, you can be the person who makes it happen. Start small — I literally just put up a sign-up sheet. It doesn''t have to be perfect.',
    'Initiative comes so naturally to you that you don''t always recognize it as a skill. But organizing a tutoring program from a library conversation is leadership in action. You''re learning to see what you do naturally as something worth naming.',
    'Baseline: initiative as natural instinct — ''I see a need and I fill it'' — doesn''t recognize it as a skill yet');

-- conv_marcus_02: Group Project Pivot (Fall Wk 7)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_marcus_02'), str_to_uuid('stu_marcus'), str_to_uuid('work_marcus_group_project'), 'Fall 2025', 7, 'completed', '2025-11-10T14:30:00Z', '2025-11-10T14:55:00Z', 1500,
    'Marcus led his BUS 200 team through a major project pivot when their survey data was unusable.',
    'Your BUS 200 group hit a wall — the survey data was unusable. Most groups would panic. You pivoted to interview-based research. Walk me through the meeting where that happened.',
    'Everyone was freaking out because the deadline was in two weeks and our whole project was based on this survey. I could see people starting to blame each other and I was like, okay we need to stop and think about this differently. What do we actually need? We need people''s opinions. Surveys aren''t the only way to get that.',
    'You said ''we need to stop and think about this differently.'' In the middle of panic and blame, you zoomed out to the purpose. Where does that instinct come from?',
    'I think I learned it from sports honestly. When a play breaks down you don''t just stand there, you improvise. You read the situation and adapt. The goal doesn''t change — getting people''s opinions — but the method has to change. I''ve always been good at that in games. I''m learning I can do it in school too.',
    'You just connected sports improvisation to academic problem solving. And last month you connected high school tutoring to building a college program. You keep drawing from one part of your life to solve problems in another. That''s a specific kind of creative thinking. Do you do that consciously?',
    'Not really? I just see connections I guess. Like when something reminds me of something else I''ve done before, I use what worked. I didn''t think of it as a strategy but maybe it is. Huh. That''s kind of interesting to think about.',
    'When the project fell apart, you zoomed out from the panic to the purpose and found a new path forward. You''re drawing on what you''ve learned in other areas of your life — sports, high school — and applying it to new situations. That cross-domain thinking is becoming a pattern.',
    'Pattern: cross-domain problem solving — draws from sports, past experience to improvise solutions in new contexts');

-- conv_marcus_03: Setback Paper (Winter Wk 7)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_marcus_03'), str_to_uuid('stu_marcus'), str_to_uuid('work_marcus_setback_paper'), 'Winter 2026', 7, 'completed', '2026-02-24T14:30:00Z', '2026-02-24T14:55:00Z', 1500,
    'Marcus received a C on his BUS 200 midterm paper — his lowest grade.',
    'A C on the midterm paper. That''s not a grade you''re used to seeing. Tell me about the moment you got that paper back.',
    'I felt sick honestly. I''m not used to getting Cs. I''ve always been the smart kid, the one who leads the group project and gets the A. So getting a C felt like the ground shifted. I didn''t know what to do with it. I went home and didn''t talk to anyone for two days.',
    'You said you ''didn''t know what to do with it'' and went silent for two days. That''s very different from how you usually handle things — you''re usually the first one to act. What was happening during those two days?',
    'I was just sitting with it I guess. Usually when something goes wrong I fix it immediately. But this time I didn''t know how to fix it. Like you can''t un-get a C. So I just... felt bad. And I think I needed to feel bad for a bit? Like processing it instead of just jumping to the solution. That''s not something I usually do.',
    'You — the person who sees a need and fills it, who pivots a project in 30 seconds — sat with a bad feeling for two days without trying to fix it. You said ''I needed to feel bad for a bit.'' For someone whose instinct is action, that''s actually a really different move. What do you think you were learning in those two days?',
    'That I can''t fix everything by doing something. Sometimes you just have to sit with it and let it be what it is. The C happened. I can work harder next time but I can''t change it. I think I''m better at starting things than I am at handling when things don''t go well. That''s probably something I should work on.',
    'Getting a C stopped you in a way that nothing else has. You sat with a difficult feeling for two days instead of jumping to fix it — and in doing so, you learned something about yourself: you''re better at starting things than sitting with setbacks. Naming that is the first step.',
    'Recognition: identified gap in resilience — strong at initiative but underdeveloped in processing setbacks without action');

-- conv_marcus_04: Mentorship (Spring Wk 3)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_marcus_04'), str_to_uuid('stu_marcus'), str_to_uuid('work_marcus_mentorship'), 'Spring 2026', 3, 'completed', '2026-04-14T11:30:00Z', '2026-04-14T11:55:00Z', 1500,
    'Marcus reflected on mentoring a first-year student.',
    'You''ve been informally mentoring a first-year student. You mentioned he reminds you of yourself. Tell me about a specific moment with him that stuck with you.',
    'Yeah his name is Andre. He came to me last week because he failed a quiz and he was like ''I''m not smart enough for this.'' And I heard myself saying all the things I wish someone had said to me when I got that C. Like ''the grade doesn''t define you'' and ''what are you going to do differently next time?'' And I was like, wait, am I actually believing this stuff now?',
    'You said ''am I actually believing this stuff now?'' — like giving advice to Andre made you realize you''d internalized something you were still working through yourself. What shifted?',
    'I think hearing myself say it out loud to someone else made it real? Like when I got the C I knew intellectually that it wasn''t the end of the world. But saying it to Andre and watching him actually calm down — I was like, oh, I actually believe this. I''m not just saying the right thing, I mean it.',
    'This is a pattern with you, Marcus. You organized tutoring after overhearing struggling students. You pivoted a project by zooming out to purpose. Now you''re mentoring Andre and discovering what you actually believe by teaching it. You learn by doing for others. Has that always been true?',
    'Yeah actually. I don''t think I learn things just by hearing them or reading them. I learn them by doing them for someone else or teaching them. That''s why I keep starting these things — tutoring, mentoring — it''s not just that I see a need. It''s how I learn. That''s kind of a big realization actually.',
    'Mentoring Andre became a mirror — you heard yourself giving advice and realized you believed it. You learn by doing for others. That''s not just initiative; it''s how you process and internalize your own growth.',
    'Recognition: learns through teaching and doing for others — initiative and learning are deeply connected for Marcus');

-- conv_sofia_01: Art Project (Winter Wk 3)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_sofia_01'), str_to_uuid('stu_sofia'), str_to_uuid('work_sofia_art_project'), 'Winter 2026', 3, 'completed', '2026-01-27T14:30:00Z', '2026-01-27T14:55:00Z', 1500,
    'Sofia combined photography with found objects for her ART 110 project.',
    'Your art professor called your mixed media project the most creative in the class. You combined photography with found objects. Walk me through how you landed on that combination.',
    'I was walking to class and I saw this broken umbrella in a puddle and it was actually really beautiful? Like the way the light hit it. And I took a photo and then later I was looking at found objects for the assignment and I was like, what if I combine these? What if the photos aren''t just photos and the objects aren''t just objects?',
    'You saw beauty in something broken and discarded. That''s a very specific way of seeing. Is that something you''ve always done — finding unexpected value in things other people overlook?',
    'Yeah actually. My mom says I''ve always been like that. I collect weird stuff — bottle caps, old keys, fabric scraps. I see potential in things. It drives my family crazy sometimes but in art class it''s actually an advantage. I think differently than most people and usually that feels weird but here it felt right.',
    'You said ''usually that feels weird but here it felt right.'' That''s important — you have a way of seeing that''s genuinely unusual, and for the first time it was valued instead of seen as odd. What does it feel like when that kind of thinking is recognized?',
    'Honestly? Really good. Like maybe the way my brain works isn''t a problem, it''s actually useful. I''ve always been told I''m ''too much'' or I overthink things or I see things that aren''t there. But in art, all of that is exactly what you need. So maybe the problem was never my brain — it was just finding the right context for it.',
    'You see potential in discarded things and make unexpected connections — and for the first time, that was recognized as a strength, not a quirk. Your creative thinking isn''t ''too much'' — it just needed the right context to be valued.',
    'Baseline: creative thinking recognized as strength for first time — reframing ''too much'' as ''exactly what''s needed''');

-- conv_sofia_02: Bio Lab (Winter Wk 5)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_sofia_02'), str_to_uuid('stu_sofia'), str_to_uuid('work_sofia_bio_lab'), 'Winter 2026', 5, 'completed', '2026-02-10T16:30:00Z', '2026-02-10T16:55:00Z', 1500,
    'Sofia identified a flaw in a biology lab procedure and proposed an improvement.',
    'You noticed something in the BIO 120 lab that nobody else caught — a potential contamination issue in the procedure. Tell me how you spotted it.',
    'Everyone was just following the steps but I kept looking at where the samples were placed relative to the air vent and I was like, that''s going to contaminate the samples. I wasn''t trying to be difficult, I just couldn''t not see it. I told the TA and she actually stopped the whole lab to move things around.',
    'You said ''I couldn''t not see it.'' That''s the same way you described seeing beauty in the broken umbrella — you can''t not notice things. But in the lab, you also spoke up. What made you say something instead of just noting it mentally?',
    'I think because the stakes were higher? Like with the art project it was just me. But in the lab, if the samples were contaminated everyone''s results would be wrong. So I felt like I had a responsibility to say something even though it was scary to challenge the procedure.',
    'In art, you see what others miss and it''s called creative. In biology, you see what others miss and it''s called critical thinking. Both times you ''couldn''t not see it.'' You seem to have a strong noticing instinct. But the interesting part is what you do after you notice. You spoke up in the lab because the stakes were high. In art, you created something new. What do you do when you notice something but the stakes feel low?',
    'Honestly? I probably keep it to myself. I only speak up when I feel like it really matters. Like if it''s just a small thing I''ll let it go. But maybe I should speak up more? Because the small things might matter more than I think.',
    'You have a powerful noticing instinct — you can''t not see things that others miss. In art it becomes creativity; in the lab it became critical thinking that protected everyone''s results. The question you''re sitting with now is what to do with all the things you notice but don''t say.',
    'Pattern: strong noticing instinct across creative and analytical domains — speaks up when stakes are high, stays quiet otherwise');

-- conv_sofia_03: Dropped Project (Winter Wk 7)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_sofia_03'), str_to_uuid('stu_sofia'), str_to_uuid('work_sofia_dropped_project'), 'Winter 2026', 7, 'completed', '2026-02-24T10:30:00Z', '2026-02-24T10:55:00Z', 1500,
    'Sofia left her SOC 100 group project after a disagreement about direction.',
    'You left your SOC 100 group project. That''s a big decision. Walk me through what happened in the group before you decided to leave.',
    'We were supposed to be designing a survey about campus food insecurity and I had this idea for how to frame the questions but the other two people in my group just wanted to use the template from the textbook. I tried to explain why my approach would get better data but they weren''t listening. So I asked the professor if I could work alone.',
    'You said ''they weren''t listening.'' Was there a moment where you decided ''I''m done trying'' — like a specific thing that happened?',
    'Yeah. The one guy literally said ''can we just do it the easy way?'' And I was like, I can''t work with people who don''t care about doing good work. I know that sounds harsh but I''d rather do it alone and do it right than compromise on quality. I''ve always been like that.',
    'You said ''I''ve always been like that'' — choosing to work alone rather than compromise. Last conversation you told me you speak up when the stakes are high. But here the stakes were high — you cared about the quality of the work — and instead of staying and fighting for your idea, you left. Is leaving and speaking up the same thing to you?',
    'No. Leaving is easier honestly. Speaking up and staying when people disagree with you is really hard. I think I left because I didn''t want to deal with the conflict, not because working alone was actually better. Like I told myself it was about quality but really it was about not wanting to argue. That''s kind of uncomfortable to admit.',
    'You told yourself you left for quality, but you just admitted it was really about avoiding conflict. That''s a brave thing to notice. Your instinct when things get hard with people is to leave and do it alone. That pattern is worth watching — because your ideas are often the best ones in the room, and they need you to stay.',
    'Recognition: pattern of abandoning collaborative work when conflict arises — frames it as quality control but recognizes it''s conflict avoidance');

-- conv_sofia_04: Team Return (Spring Wk 4)
INSERT INTO growth_conversation (id, student_id, work_id, quarter, week_number, status, started_at, completed_at, duration_seconds, work_context, prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, prompt_phase_3, response_phase_3, synthesis_text, suggested_insight) VALUES
  (str_to_uuid('conv_sofia_04'), str_to_uuid('stu_sofia'), str_to_uuid('work_sofia_team_return'), 'Spring 2026', 4, 'completed', '2026-04-21T10:30:00Z', '2026-04-21T10:55:00Z', 1500,
    'After coaching conversations, Sofia rejoined a group project and stayed through disagreements.',
    'You rejoined a group project this quarter — a SOC 100 team. Last time, you left when there was conflict. This time you stayed. Tell me about the first disagreement and what happened.',
    'So we were planning the research design and I disagreed with how they wanted to code the data. And I could feel myself wanting to just be like ''fine, do it your way'' or leave. But I remembered what I said last time about conflict avoidance and I was like, no, stay. So I said ''I think there''s a better way to do this, can I show you?''',
    'You said ''I could feel myself wanting to leave'' but you stayed. You caught the instinct and chose differently. What did that cost you? What did it feel like to stay?',
    'It was so uncomfortable. Like physically uncomfortable. My chest was tight and I wanted to leave the whole time. But I showed them my coding method and they actually liked it. And then we had another disagreement later about something else and I stayed for that too. It got a tiny bit easier the second time.',
    'Two conversations ago, you admitted that leaving groups was about conflict avoidance, not quality. Now you''ve stayed through two disagreements, and the second one was easier than the first. You described the same thing Aja described about reaching out — the courage threshold gets lower each time you do it. For you, the hard thing isn''t reaching out — it''s staying. What do you notice?',
    'Yeah. My version of the hard thing is staying when I want to leave. For some people it''s speaking up. For me it''s not leaving. And I think I proved to myself this week that I can do it even though it''s uncomfortable. My ideas actually got used because I stayed to defend them instead of walking away.',
    'You stayed through two disagreements — and your ideas were better for it. The discomfort didn''t go away, but you chose to sit with it instead of leaving. Your courage muscle is ''staying,'' and it got a little stronger this week.',
    'Shift: from conflict avoidance (leaving) to conflict tolerance (staying) — ''staying is my version of the hard thing''');

-- ─── CONVERSATION SKILL TAGS ────────────────────────

INSERT INTO conversation_skill_tag (conversation_id, skill_id, confidence, student_confirmed, rationale) VALUES
  -- conv_aja_01
  (str_to_uuid('conv_aja_01'), str_to_uuid('skill_resilience'), 0.82, true, 'Aja''s onboarding definition centers on resilience as endurance and not giving up.'),
  -- conv_aja_02
  (str_to_uuid('conv_aja_02'), str_to_uuid('skill_resilience'), 0.88, true, 'Aja described breaking a pattern of quitting when things get difficult, choosing to seek help instead.'),
  -- conv_aja_03
  (str_to_uuid('conv_aja_03'), str_to_uuid('skill_resilience'), 0.80, true, 'Showing up despite feeling like she doesn''t belong and discovering she does.'),
  (str_to_uuid('conv_aja_03'), str_to_uuid('skill_initiative'), 0.62, false, 'Staying in the study group and engaging was a quiet act of initiative.'),
  -- conv_aja_04
  (str_to_uuid('conv_aja_04'), str_to_uuid('skill_creative_problem_solving'), 0.85, true, 'Came up with a mutually beneficial shift swap that solved both students'' scheduling conflicts.'),
  -- conv_aja_05
  (str_to_uuid('conv_aja_05'), str_to_uuid('skill_initiative'), 0.87, true, 'Aja saw a need and organized a study group without being prompted, stepping into leadership.'),
  -- conv_aja_06
  (str_to_uuid('conv_aja_06'), str_to_uuid('skill_resilience'), 0.92, true, 'Aja chose to call her professor despite fear of judgment, naming reach-out as the harder and braver choice.'),
  (str_to_uuid('conv_aja_06'), str_to_uuid('skill_initiative'), 0.70, true, 'Proactively contacted professor rather than accepting the situation passively.'),
  -- conv_aja_07
  (str_to_uuid('conv_aja_07'), str_to_uuid('skill_resilience'), 0.78, true, 'Essay demonstrated pattern of increasingly adaptive responses to challenges.'),
  (str_to_uuid('conv_aja_07'), str_to_uuid('skill_critical_thinking'), 0.72, true, 'Metacognitive reflection — analyzing her own patterns and growth across situations.'),
  -- conv_aja_08
  (str_to_uuid('conv_aja_08'), str_to_uuid('skill_resilience'), 0.90, true, 'Failed a quiz and went to office hours the same day, reframing the setback as information.'),
  (str_to_uuid('conv_aja_08'), str_to_uuid('skill_self_directed_learning'), 0.68, true, 'Immediately sought learning support without external prompting.'),
  -- conv_aja_09
  (str_to_uuid('conv_aja_09'), str_to_uuid('skill_creative_problem_solving'), 0.91, true, 'Connected personal experience (grandmother''s voice messages) to redesign survey methodology.'),
  -- conv_aja_10
  (str_to_uuid('conv_aja_10'), str_to_uuid('skill_critical_thinking'), 0.88, true, 'Caught herself about to share unverified statistics, applied media literacy skills in real time.'),
  -- conv_aja_11
  (str_to_uuid('conv_aja_11'), str_to_uuid('skill_self_directed_learning'), 0.90, true, 'Independently identified a need and taught herself Excel to create an inventory system nobody asked for.'),
  -- conv_aja_12
  (str_to_uuid('conv_aja_12'), str_to_uuid('skill_resilience'), 0.95, true, 'End-of-year synthesis demonstrating deep transformation in understanding of resilience.'),
  -- conv_marcus_01
  (str_to_uuid('conv_marcus_01'), str_to_uuid('skill_initiative'), 0.92, true, 'Created a peer tutoring program from scratch without being prompted.'),
  -- conv_marcus_02
  (str_to_uuid('conv_marcus_02'), str_to_uuid('skill_creative_problem_solving'), 0.88, true, 'Pivoted team''s project approach by drawing on sports improvisation instincts.'),
  (str_to_uuid('conv_marcus_02'), str_to_uuid('skill_initiative'), 0.75, true, 'Stepped into leadership during a group crisis without being asked.'),
  -- conv_marcus_03
  (str_to_uuid('conv_marcus_03'), str_to_uuid('skill_resilience'), 0.82, true, 'Confronted a major setback and recognized a pattern of avoiding difficult emotions through action.'),
  -- conv_marcus_04
  (str_to_uuid('conv_marcus_04'), str_to_uuid('skill_initiative'), 0.85, true, 'Informal mentoring as a way of processing and internalizing growth.'),
  (str_to_uuid('conv_marcus_04'), str_to_uuid('skill_resilience'), 0.70, true, 'Processing his own C-grade experience by helping Andre through a similar one.'),
  -- conv_sofia_01
  (str_to_uuid('conv_sofia_01'), str_to_uuid('skill_creative_problem_solving'), 0.90, true, 'Combined photography with found objects in a way the professor called the most creative in the class.'),
  -- conv_sofia_02
  (str_to_uuid('conv_sofia_02'), str_to_uuid('skill_critical_thinking'), 0.88, true, 'Identified procedural flaw in lab that could have affected everyone''s results.'),
  (str_to_uuid('conv_sofia_02'), str_to_uuid('skill_creative_problem_solving'), 0.65, false, 'Same noticing instinct that drives her art applied to scientific observation.'),
  -- conv_sofia_03
  (str_to_uuid('conv_sofia_03'), str_to_uuid('skill_resilience'), 0.75, true, 'Recognized her own pattern of leaving when things get difficult in group settings.'),
  -- conv_sofia_04
  (str_to_uuid('conv_sofia_04'), str_to_uuid('skill_resilience'), 0.85, true, 'Stayed through group conflict after recognizing her pattern of avoidance.'),
  (str_to_uuid('conv_sofia_04'), str_to_uuid('skill_initiative'), 0.68, true, 'Proactively offered alternative approach instead of passively accepting or leaving.');

-- ─── STUDENT SKILL DEFINITIONS ──────────────────────

INSERT INTO student_skill_definition (id, student_id, skill_id, definition_text, personal_example, why_it_matters, version, is_current, prompted_by, created_at) VALUES
  -- Aja initial (Fall 2025)
  (str_to_uuid('def_aja_res_v1'), str_to_uuid('stu_aja'), str_to_uuid('skill_resilience'),
    'Resilience means being strong enough to not give up when things get hard. It''s about pushing through no matter what.',
    'My mom is the most resilient person I know. She never gives up.',
    'Because I''ve quit too many things and I don''t want to do that anymore.',
    1, false, 'initial_onboarding', '2025-09-08T10:30:00Z'),
  (str_to_uuid('def_aja_init_v1'), str_to_uuid('stu_aja'), str_to_uuid('skill_initiative'),
    'Initiative is doing things before someone tells you to do them.',
    'When I signed up for NLU without anyone pushing me to go back to school.',
    NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:35:00Z'),
  (str_to_uuid('def_aja_cps_v1'), str_to_uuid('stu_aja'), str_to_uuid('skill_creative_problem_solving'),
    'Creative problem solving is finding new ways to fix things when the normal way doesn''t work.',
    NULL, NULL,
    1, false, 'initial_onboarding', '2025-09-08T10:40:00Z'),
  (str_to_uuid('def_aja_ct_v1'), str_to_uuid('stu_aja'), str_to_uuid('skill_critical_thinking'),
    'Critical thinking is not just believing everything you hear. Looking at things carefully before you decide what''s true.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:45:00Z'),
  (str_to_uuid('def_aja_sdl_v1'), str_to_uuid('stu_aja'), str_to_uuid('skill_self_directed_learning'),
    'Teaching yourself things without someone standing over you telling you what to do.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:50:00Z'),
  -- Aja revised
  (str_to_uuid('def_aja_res_v2'), str_to_uuid('stu_aja'), str_to_uuid('skill_resilience'),
    'Resilience is knowing when to push through, when to ask for help, and how to learn from times things don''t go the way I planned. It''s not about being tough — it''s about being honest with yourself about what you need.',
    'Calling my professor at 7am when childcare fell through instead of just not showing up.',
    'Because pushing through alone isn''t actually strong — knowing what you need and asking for it is the harder, braver thing.',
    2, true, 'conversation_prompted', '2026-06-02T16:30:00Z'),
  (str_to_uuid('def_aja_cps_v2'), str_to_uuid('stu_aja'), str_to_uuid('skill_creative_problem_solving'),
    'Looking at situations from angles others haven''t considered. Questioning the way things are ''supposed'' to be done and finding better approaches by connecting unexpected things.',
    'Suggesting voice memos instead of written surveys because not everyone reads well.',
    NULL,
    2, true, 'conversation_prompted', '2026-04-07T10:55:00Z'),
  -- Marcus
  (str_to_uuid('def_marcus_init_v1'), str_to_uuid('stu_marcus'), str_to_uuid('skill_initiative'),
    'Doing things before someone tells you. Seeing a need and filling it.',
    'Setting up the peer tutoring program because I saw students struggling.',
    NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:30:00Z'),
  (str_to_uuid('def_marcus_cps_v1'), str_to_uuid('stu_marcus'), str_to_uuid('skill_creative_problem_solving'),
    'Finding a different way when the first way doesn''t work. Thinking on your feet.',
    'Pivoting our BUS 200 project from surveys to interviews when the data was bad.',
    NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:35:00Z'),
  (str_to_uuid('def_marcus_res_v1'), str_to_uuid('stu_marcus'), str_to_uuid('skill_resilience'),
    'Bouncing back from setbacks. Not letting failure define you.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:40:00Z'),
  (str_to_uuid('def_marcus_ct_v1'), str_to_uuid('stu_marcus'), str_to_uuid('skill_critical_thinking'),
    'Thinking carefully about information before making decisions.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:45:00Z'),
  (str_to_uuid('def_marcus_sdl_v1'), str_to_uuid('stu_marcus'), str_to_uuid('skill_self_directed_learning'),
    'Figuring things out on your own when nobody''s there to teach you.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2025-09-08T10:50:00Z'),
  -- Sofia
  (str_to_uuid('def_sofia_cps_v1'), str_to_uuid('stu_sofia'), str_to_uuid('skill_creative_problem_solving'),
    'Seeing possibilities that other people miss. Making connections between things that don''t obviously go together.',
    'Combining photography with found objects for my art project.',
    NULL,
    1, true, 'initial_onboarding', '2026-01-13T10:30:00Z'),
  (str_to_uuid('def_sofia_ct_v1'), str_to_uuid('stu_sofia'), str_to_uuid('skill_critical_thinking'),
    'Looking deeper than the surface. Questioning whether things are actually true or just seem true.',
    'Spotting the contamination risk in the bio lab that nobody else noticed.',
    NULL,
    1, true, 'initial_onboarding', '2026-01-13T10:35:00Z'),
  (str_to_uuid('def_sofia_res_v1'), str_to_uuid('stu_sofia'), str_to_uuid('skill_resilience'),
    'Sticking with things even when they get hard. Not running away from problems.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2026-01-13T10:40:00Z'),
  (str_to_uuid('def_sofia_init_v1'), str_to_uuid('stu_sofia'), str_to_uuid('skill_initiative'),
    'Starting things on your own without waiting for someone to tell you what to do.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2026-01-13T10:45:00Z'),
  (str_to_uuid('def_sofia_sdl_v1'), str_to_uuid('stu_sofia'), str_to_uuid('skill_self_directed_learning'),
    'Being curious enough to learn things on your own just because you want to know.',
    NULL, NULL,
    1, true, 'initial_onboarding', '2026-01-13T10:50:00Z');

-- ─── SKILL ASSESSMENTS ──────────────────────────────

INSERT INTO skill_assessment (id, student_id, skill_id, assessor_type, assessor_id, sdt_level, rationale, confidence, quarter, assessed_at) VALUES
  -- Aja Coach Fall 2025
  (str_to_uuid('assess_aja_res_coach_f25'), str_to_uuid('stu_aja'), str_to_uuid('skill_resilience'), 'coach', str_to_uuid('coach_elizabeth'), 'practicing', 'Aja is actively seeking help instead of quitting. Writing center visit and study group attendance show practicing-level resilience.', 4, 'Fall 2025', '2025-12-10T10:00:00Z'),
  (str_to_uuid('assess_aja_init_coach_f25'), str_to_uuid('stu_aja'), str_to_uuid('skill_initiative'), 'coach', str_to_uuid('coach_elizabeth'), 'noticing', 'Beginning to notice opportunities. Shift swap was a good sign but still emerging.', 3, 'Fall 2025', '2025-12-10T10:00:00Z'),
  (str_to_uuid('assess_aja_cps_coach_f25'), str_to_uuid('stu_aja'), str_to_uuid('skill_creative_problem_solving'), 'coach', str_to_uuid('coach_elizabeth'), 'practicing', 'Shift swap proposal showed creative thinking. Applying across contexts.', 3, 'Fall 2025', '2025-12-10T10:00:00Z'),
  (str_to_uuid('assess_aja_ct_coach_f25'), str_to_uuid('stu_aja'), str_to_uuid('skill_critical_thinking'), 'coach', str_to_uuid('coach_elizabeth'), 'noticing', 'Early stage. Beginning to question but not yet consistently applying critical lens.', 3, 'Fall 2025', '2025-12-10T10:00:00Z'),
  (str_to_uuid('assess_aja_sdl_coach_f25'), str_to_uuid('stu_aja'), str_to_uuid('skill_self_directed_learning'), 'coach', str_to_uuid('coach_elizabeth'), 'noticing', 'Recognizes when she needs help but not yet self-directing learning independently.', 3, 'Fall 2025', '2025-12-10T10:00:00Z'),
  -- Aja Coach Spring 2026
  (str_to_uuid('assess_aja_res_coach_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_resilience'), 'coach', str_to_uuid('coach_elizabeth'), 'integrating', 'Aja consistently seeks help, reframes setbacks, and has internalized resilience as learning rather than endurance. Midterm phone call and same-day office hours are strong examples.', 5, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_aja_init_coach_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_initiative'), 'coach', str_to_uuid('coach_elizabeth'), 'practicing', 'Organized study group, proposed survey redesign. Growing but still building confidence.', 4, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_aja_cps_coach_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_creative_problem_solving'), 'coach', str_to_uuid('coach_elizabeth'), 'integrating', 'Voice memo survey idea was genuinely creative and applied across domains. Connecting personal experience to methodology.', 4, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_aja_ct_coach_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_critical_thinking'), 'coach', str_to_uuid('coach_elizabeth'), 'noticing', 'News article moment was good but still applying critical thinking mainly when topics are personally relevant.', 3, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_aja_sdl_coach_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_self_directed_learning'), 'coach', str_to_uuid('coach_elizabeth'), 'practicing', 'Excel self-teaching was strong self-directed learning. Moving from seeking help to creating solutions independently.', 4, 'Spring 2026', '2026-04-15T10:00:00Z'),
  -- Aja Self Spring 2026
  (str_to_uuid('assess_aja_res_self_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_resilience'), 'self', NULL, 'integrating', 'I think I''m getting good at this. I reach out when I need to and I learn from setbacks.', 4, 'Spring 2026', '2026-06-02T16:00:00Z'),
  (str_to_uuid('assess_aja_init_self_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_initiative'), 'self', NULL, 'practicing', 'I''m starting to do things without being asked but I still need someone to validate me first sometimes.', 3, 'Spring 2026', '2026-06-02T16:00:00Z'),
  (str_to_uuid('assess_aja_cps_self_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_creative_problem_solving'), 'self', NULL, 'integrating', 'I see problems differently than most people and I''m learning to trust that.', 4, 'Spring 2026', '2026-06-02T16:00:00Z'),
  (str_to_uuid('assess_aja_ct_self_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_critical_thinking'), 'self', NULL, 'practicing', 'I''m better at questioning things now but I still mostly do it when the topic matters to me personally.', 3, 'Spring 2026', '2026-06-02T16:00:00Z'),
  (str_to_uuid('assess_aja_sdl_self_sp26'), str_to_uuid('stu_aja'), str_to_uuid('skill_self_directed_learning'), 'self', NULL, 'practicing', 'The Excel thing was big for me. I taught myself something useful without anyone telling me to.', 4, 'Spring 2026', '2026-06-02T16:00:00Z'),
  -- Marcus Coach Spring 2026
  (str_to_uuid('assess_marcus_init_coach_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_initiative'), 'coach', str_to_uuid('coach_elizabeth'), 'integrating', 'Marcus consistently creates opportunities across contexts — tutoring, mentoring, student government.', 5, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_marcus_cps_coach_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_creative_problem_solving'), 'coach', str_to_uuid('coach_elizabeth'), 'integrating', 'Strong cross-domain thinking. Draws from sports, past experience to solve new problems.', 4, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_marcus_res_coach_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_resilience'), 'coach', str_to_uuid('coach_elizabeth'), 'practicing', 'The C paper was a growth moment. He''s learning to sit with difficulty instead of immediately acting.', 3, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_marcus_ct_coach_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_critical_thinking'), 'coach', str_to_uuid('coach_elizabeth'), 'practicing', 'Developing but not his strongest area. Tends toward action before analysis.', 3, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_marcus_sdl_coach_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_self_directed_learning'), 'coach', str_to_uuid('coach_elizabeth'), 'noticing', 'Learns well through doing for others but hasn''t yet developed independent learning habits.', 3, 'Spring 2026', '2026-04-15T10:00:00Z'),
  -- Marcus Self Spring 2026
  (str_to_uuid('assess_marcus_init_self_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_initiative'), 'self', NULL, 'practicing', 'I do things without being asked but I don''t think of it as special.', 3, 'Spring 2026', '2026-04-14T12:00:00Z'),
  (str_to_uuid('assess_marcus_res_self_sp26'), str_to_uuid('stu_marcus'), str_to_uuid('skill_resilience'), 'self', NULL, 'noticing', 'I''m starting to notice that I''m not great at handling setbacks.', 2, 'Spring 2026', '2026-04-14T12:00:00Z'),
  -- Sofia Coach Spring 2026
  (str_to_uuid('assess_sofia_cps_coach_sp26'), str_to_uuid('stu_sofia'), str_to_uuid('skill_creative_problem_solving'), 'coach', str_to_uuid('coach_angelica'), 'integrating', 'Sofia sees connections others miss across art, science, and social contexts.', 5, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_sofia_ct_coach_sp26'), str_to_uuid('stu_sofia'), str_to_uuid('skill_critical_thinking'), 'coach', str_to_uuid('coach_angelica'), 'integrating', 'Lab procedure catch and journal analysis show integrating-level critical thinking.', 4, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_sofia_res_coach_sp26'), str_to_uuid('stu_sofia'), str_to_uuid('skill_resilience'), 'coach', str_to_uuid('coach_angelica'), 'noticing', 'Pattern of leaving when things get hard. Recent group return is promising but still early.', 3, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_sofia_init_coach_sp26'), str_to_uuid('stu_sofia'), str_to_uuid('skill_initiative'), 'coach', str_to_uuid('coach_angelica'), 'practicing', 'Research pitch was strong initiative. Becoming more willing to put ideas forward.', 3, 'Spring 2026', '2026-04-15T10:00:00Z'),
  (str_to_uuid('assess_sofia_sdl_coach_sp26'), str_to_uuid('stu_sofia'), str_to_uuid('skill_self_directed_learning'), 'coach', str_to_uuid('coach_angelica'), 'practicing', 'Learns creatively and independently in art domain. Extending to other areas.', 3, 'Spring 2026', '2026-04-15T10:00:00Z');

-- ─── STUDENT GOALS ──────────────────────────────────

INSERT INTO student_goal (id, student_id, goal_text, quarter, status, progress_notes, outcome_reflection, carried_forward, previous_goal_id, created_at) VALUES
  (str_to_uuid('goal_aja_f25_1'), str_to_uuid('stu_aja'),
    'Ask for help at least once a week instead of trying to handle everything alone.',
    'Fall 2025', 'completed',
    'Writing center visit, study group attendance. Met goal consistently.',
    'I did it more than once a week most weeks. It got easier.',
    false, NULL, '2025-09-15T10:00:00Z'),
  (str_to_uuid('goal_aja_w26_1'), str_to_uuid('stu_aja'),
    'Take initiative on something — start a group, propose an idea, don''t wait for someone else.',
    'Winter 2026', 'completed',
    'Started the stats study group. Called professor proactively. Proposed survey redesign.',
    'I went from needing permission to just doing things. The study group was the turning point.',
    false, str_to_uuid('goal_aja_f25_1'), '2026-01-13T10:00:00Z'),
  (str_to_uuid('goal_aja_sp26_1'), str_to_uuid('stu_aja'),
    'Apply critical thinking to topics I don''t personally care about, not just things that hit close to home.',
    'Spring 2026', 'active',
    'Caught myself with the news article. Still mostly applies to personal topics though.',
    NULL,
    false, NULL, '2026-04-07T10:00:00Z'),
  (str_to_uuid('goal_aja_sp26_2'), str_to_uuid('stu_aja'),
    'Revise at least two skill definitions to reflect how my understanding has changed.',
    'Spring 2026', 'completed',
    'Revised Resilience and Creative Problem Solving definitions.',
    'Both definitions feel more real now. They''re mine, not just textbook words.',
    false, NULL, '2026-04-07T10:00:00Z'),
  (str_to_uuid('goal_marcus_f25_1'), str_to_uuid('stu_marcus'),
    'Learn to sit with setbacks instead of immediately trying to fix them.',
    'Fall 2025', 'active',
    'The C on the midterm paper was a test of this. Sat with it for 2 days. Progress.',
    NULL,
    true, NULL, '2025-11-15T10:00:00Z'),
  (str_to_uuid('goal_marcus_sp26_1'), str_to_uuid('stu_marcus'),
    'Continue mentoring Andre and learn from the experience of teaching others.',
    'Spring 2026', 'active',
    'Mentoring relationship is going well. Realizing I learn by teaching.',
    NULL,
    false, NULL, '2026-04-01T10:00:00Z'),
  (str_to_uuid('goal_sofia_w26_1'), str_to_uuid('stu_sofia'),
    'Stay in group work even when it gets uncomfortable. Practice not leaving.',
    'Winter 2026', 'adjusted',
    'Left one group project but recognized the pattern. Adjusted approach for spring.',
    NULL,
    true, NULL, '2026-01-20T10:00:00Z'),
  (str_to_uuid('goal_sofia_sp26_1'), str_to_uuid('stu_sofia'),
    'Speak up more in group settings — share ideas even when I think they might be rejected.',
    'Spring 2026', 'active',
    'Stayed through two disagreements in the new group. Offered alternative coding method.',
    NULL,
    false, str_to_uuid('goal_sofia_w26_1'), '2026-04-01T10:00:00Z');

-- ─── COACH NOTES ────────────────────────────────────

INSERT INTO coach_note (id, coach_id, student_id, note_text, bright_spot, next_step, session_date, quarter, contact_method) VALUES
  (str_to_uuid('note_eliz_aja_01'), str_to_uuid('coach_elizabeth'), str_to_uuid('stu_aja'),
    'First meeting with Aja. She''s nervous but motivated. Daughter is clearly her anchor. Talked about tendency to isolate when stressed — she''s aware of it, which is good. Set goal around asking for help once a week.',
    'Self-awareness about isolation pattern. Already took the step of enrolling.',
    'Check in on writing center visit. Normalize help-seeking.',
    '2025-09-15', 'Fall 2025', 'in_person'),
  (str_to_uuid('note_eliz_aja_02'), str_to_uuid('coach_elizabeth'), str_to_uuid('stu_aja'),
    'Aja went to the writing center and was surprised it wasn''t judgmental. She''s starting to see a pattern of choosing help over quitting. The shift swap at work was creative and unprompted.',
    'Shift swap proposal — creative and proactive. Didn''t need coaching to think of it.',
    'Encourage her to see the shift swap as a skill, not just lucky thinking.',
    '2025-11-10', 'Fall 2025', 'video'),
  (str_to_uuid('note_eliz_aja_03'), str_to_uuid('coach_elizabeth'), str_to_uuid('stu_aja'),
    'Aja called her professor at 7am when childcare fell through. This is a massive shift from the beginning of fall quarter. She''s not just asking for help — she''s choosing to reach out proactively. Language is changing: "reaching out isn''t weakness."',
    '"Reaching out isn''t weakness — it''s the harder, braver thing to do." Her words, not mine.',
    'Revisit resilience definition. Her lived experience has outgrown her definition.',
    '2026-02-20', 'Winter 2026', 'in_person'),
  (str_to_uuid('note_eliz_aja_04'), str_to_uuid('coach_elizabeth'), str_to_uuid('stu_aja'),
    'Aja taught herself Excel from YouTube for work. Her manager noticed. She didn''t need permission or validation — she just saw a need and solved it. Initiative and self-directed learning are both growing. Suggested she revise her resilience definition this quarter.',
    'Excel self-teaching. Unprompted, self-directed, and immediately useful.',
    'Support definition revision for Resilience. May be ready for CPS revision too.',
    '2026-05-22', 'Spring 2026', 'in_person'),
  (str_to_uuid('note_eliz_marcus_01'), str_to_uuid('coach_elizabeth'), str_to_uuid('stu_marcus'),
    'Marcus is a natural leader. He started a tutoring program, pivoted a group project, and organized student government budgets. Initiative comes easily to him. The challenge will be helping him develop in areas that don''t come naturally — especially sitting with difficulty.',
    'Cross-domain problem solving is a genuine strength. Draws from sports, past experience.',
    'Watch for how he handles the next setback. The C on the midterm was a data point.',
    '2026-03-01', 'Winter 2026', 'in_person'),
  (str_to_uuid('note_eliz_marcus_02'), str_to_uuid('coach_elizabeth'), str_to_uuid('stu_marcus'),
    'Marcus is mentoring a first-year student named Andre. He described hearing himself give advice and realizing he actually believed it. This is how Marcus learns — through doing for others. His initiative and learning style are deeply connected.',
    'Mentoring as self-discovery. "Am I actually believing this stuff now?"',
    'Help him see that his self-assessment gap (Initiative: self=Practicing, coach=Integrating) might mean he''s too humble about his strengths.',
    '2026-04-18', 'Spring 2026', 'video'),
  (str_to_uuid('note_ang_sofia_01'), str_to_uuid('coach_angelica'), str_to_uuid('stu_sofia'),
    'Sofia is brilliant — sees things others miss in both art and science. But she has a strong pattern of leaving when group work gets uncomfortable. She left her SOC 100 group and told herself it was about quality, but in our conversation she admitted it was conflict avoidance.',
    'Honesty about the real reason for leaving the group. Self-awareness is growing.',
    'Set up conditions for her to practice staying next quarter. Lower stakes group first.',
    '2026-03-01', 'Winter 2026', 'in_person'),
  (str_to_uuid('note_ang_sofia_02'), str_to_uuid('coach_angelica'), str_to_uuid('stu_sofia'),
    'Sofia rejoined a group project and stayed through two disagreements. She described it as "physically uncomfortable" but she stayed. Her ideas got used because she defended them. This is real progress on resilience and initiative.',
    '"Staying is my version of the hard thing." Beautiful self-articulation.',
    'Help her see the connection between her noticing instinct (creative + critical) and her conflict avoidance. Same sensitivity, different contexts.',
    '2026-04-25', 'Spring 2026', 'in_person');

-- ─── CLEANUP ────────────────────────────────────────
-- Drop the helper function if you prefer not to keep it
-- DROP FUNCTION IF EXISTS str_to_uuid(text);
