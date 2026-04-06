-- LE3 Growth Portfolio — Initial Schema
-- Run in Supabase SQL Editor or via supabase db push

-- ─── PEOPLE ──────────────────────────────────────────

create table coach (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  name text not null,
  email text unique not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table student (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  nlu_id text unique not null,
  first_name text not null,
  last_name text not null,
  email text unique not null,
  coach_id uuid not null references coach(id),
  cohort text not null,
  program_start_date date not null,
  status text not null default 'active'
    check (status in ('active', 'on_leave', 'withdrawn', 'graduated')),
  created_at timestamptz not null default now()
);

-- ─── SKILLS FRAMEWORK ────────────────────────────────

create table pillar (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  display_order int not null
);

create table durable_skill (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references pillar(id),
  name text not null,
  description text,
  display_order int not null,
  is_active boolean not null default true
);

create table rubric (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references durable_skill(id),
  version int not null,
  noticing_descriptors jsonb not null,
  practicing_descriptors jsonb not null,
  integrating_descriptors jsonb not null,
  evolving_descriptors jsonb not null,
  is_current boolean not null
);

-- ─── STUDENT WORK ────────────────────────────────────

create table student_work (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id),
  title text not null,
  description text,
  work_type text not null
    check (work_type in ('essay', 'project', 'discussion_post', 'presentation',
                          'exam', 'lab_report', 'portfolio_piece', 'other')),
  course_name text,
  course_code text,
  submitted_at timestamptz not null,
  quarter text not null,
  week_number int,
  content text,
  grade text
);

-- ─── GROWTH CONVERSATION ─────────────────────────────

create table growth_conversation (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id),
  work_id uuid references student_work(id),
  quarter text not null,
  week_number int,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds int,

  -- Phase 1: What Happened
  work_context text,
  prompt_phase_1 text,
  response_phase_1 text,

  -- Phase 2: What You Did
  prompt_phase_2 text,
  response_phase_2 text,

  -- Phase 3: What It Means
  prompt_phase_3 text,
  response_phase_3 text,

  -- Synthesis
  synthesis_text text,
  suggested_insight text
);

create table conversation_skill_tag (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references growth_conversation(id) on delete cascade,
  skill_id uuid not null references durable_skill(id),
  confidence float not null,
  student_confirmed boolean not null default false,
  rationale text,
  tagged_at timestamptz not null default now()
);

-- ─── SKILL DEFINITIONS ───────────────────────────────

create table student_skill_definition (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id),
  skill_id uuid not null references durable_skill(id),
  definition_text text not null,
  personal_example text,
  why_it_matters text,
  version int not null default 1,
  is_current boolean not null default true,
  prompted_by text
    check (prompted_by in ('initial_onboarding', 'quarterly_revision',
                            'conversation_prompted', 'self_initiated')),
  created_at timestamptz not null default now()
);

-- ─── ASSESSMENTS ─────────────────────────────────────

create table skill_assessment (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id),
  skill_id uuid not null references durable_skill(id),
  assessor_type text not null check (assessor_type in ('self', 'coach')),
  assessor_id uuid,
  sdt_level text not null
    check (sdt_level in ('noticing', 'practicing', 'integrating', 'evolving')),
  rationale text,
  confidence int check (confidence between 1 and 5),
  quarter text not null,
  assessed_at timestamptz not null
);

-- ─── GOALS ───────────────────────────────────────────

create table student_goal (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id),
  goal_text text not null,
  quarter text not null,
  status text not null default 'active'
    check (status in ('active', 'adjusted', 'completed', 'abandoned')),
  progress_notes text,
  outcome_reflection text,
  carried_forward boolean not null default false,
  previous_goal_id uuid references student_goal(id),
  created_at timestamptz not null default now()
);

-- ─── COACH NOTES ─────────────────────────────────────

create table coach_note (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach(id),
  student_id uuid not null references student(id),
  note_text text not null,
  bright_spot text,
  next_step text,
  session_date date not null,
  quarter text not null,
  contact_method text not null
    check (contact_method in ('in_person', 'video', 'phone', 'text', 'email')),
  created_at timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────

alter table student enable row level security;
alter table coach enable row level security;
alter table growth_conversation enable row level security;
alter table student_skill_definition enable row level security;
alter table skill_assessment enable row level security;
alter table student_goal enable row level security;
alter table coach_note enable row level security;
alter table student_work enable row level security;
alter table conversation_skill_tag enable row level security;
alter table pillar enable row level security;
alter table durable_skill enable row level security;
alter table rubric enable row level security;

-- Skills framework is public (read-only for everyone)
create policy "Anyone reads pillars" on pillar for select using (true);
create policy "Anyone reads skills" on durable_skill for select using (true);
create policy "Anyone reads rubrics" on rubric for select using (true);

-- Students see only their own data
create policy "Students see own record" on student
  for select using (auth_user_id = auth.uid());

create policy "Coaches see assigned students" on student
  for select using (coach_id in (
    select id from coach where auth_user_id = auth.uid()
  ));

create policy "Coaches see own record" on coach
  for select using (auth_user_id = auth.uid());

-- Student work
create policy "Students see own work" on student_work
  for select using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Coaches see student work" on student_work
  for select using (student_id in (
    select id from student where coach_id in (
      select id from coach where auth_user_id = auth.uid()
    )
  ));

-- Conversations
create policy "Students see own conversations" on growth_conversation
  for select using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students insert own conversations" on growth_conversation
  for insert with check (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students update own conversations" on growth_conversation
  for update using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Coaches see student conversations" on growth_conversation
  for select using (student_id in (
    select id from student where coach_id in (
      select id from coach where auth_user_id = auth.uid()
    )
  ));

-- Conversation skill tags
create policy "Students see own skill tags" on conversation_skill_tag
  for select using (conversation_id in (
    select id from growth_conversation where student_id in (
      select id from student where auth_user_id = auth.uid()
    )
  ));

create policy "Students insert skill tags" on conversation_skill_tag
  for insert with check (conversation_id in (
    select id from growth_conversation where student_id in (
      select id from student where auth_user_id = auth.uid()
    )
  ));

create policy "Students update skill tags" on conversation_skill_tag
  for update using (conversation_id in (
    select id from growth_conversation where student_id in (
      select id from student where auth_user_id = auth.uid()
    )
  ));

create policy "Coaches see student skill tags" on conversation_skill_tag
  for select using (conversation_id in (
    select id from growth_conversation where student_id in (
      select id from student where coach_id in (
        select id from coach where auth_user_id = auth.uid()
      )
    )
  ));

-- Skill definitions
create policy "Students see own definitions" on student_skill_definition
  for select using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students insert own definitions" on student_skill_definition
  for insert with check (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students update own definitions" on student_skill_definition
  for update using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Coaches see student definitions" on student_skill_definition
  for select using (student_id in (
    select id from student where coach_id in (
      select id from coach where auth_user_id = auth.uid()
    )
  ));

-- Assessments
create policy "Students see own assessments" on skill_assessment
  for select using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students insert self assessments" on skill_assessment
  for insert with check (
    assessor_type = 'self' and student_id in (
      select id from student where auth_user_id = auth.uid()
    )
  );

create policy "Coaches see student assessments" on skill_assessment
  for select using (student_id in (
    select id from student where coach_id in (
      select id from coach where auth_user_id = auth.uid()
    )
  ));

create policy "Coaches insert assessments" on skill_assessment
  for insert with check (
    assessor_type = 'coach' and assessor_id in (
      select id from coach where auth_user_id = auth.uid()
    )
  );

-- Goals
create policy "Students see own goals" on student_goal
  for select using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students insert own goals" on student_goal
  for insert with check (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Students update own goals" on student_goal
  for update using (student_id in (
    select id from student where auth_user_id = auth.uid()
  ));

create policy "Coaches see student goals" on student_goal
  for select using (student_id in (
    select id from student where coach_id in (
      select id from coach where auth_user_id = auth.uid()
    )
  ));

-- Coach notes
create policy "Coaches see own notes" on coach_note
  for select using (coach_id in (
    select id from coach where auth_user_id = auth.uid()
  ));

create policy "Coaches insert own notes" on coach_note
  for insert with check (coach_id in (
    select id from coach where auth_user_id = auth.uid()
  ));

create policy "Coaches update own notes" on coach_note
  for update using (coach_id in (
    select id from coach where auth_user_id = auth.uid()
  ));

-- ─── INDEXES ─────────────────────────────────────────

create index idx_conversation_student on growth_conversation(student_id);
create index idx_conversation_status on growth_conversation(status);
create index idx_conversation_work on growth_conversation(work_id);
create index idx_skill_tag_conversation on conversation_skill_tag(conversation_id);
create index idx_skill_tag_skill on conversation_skill_tag(skill_id);
create index idx_definition_student_skill on student_skill_definition(student_id, skill_id);
create index idx_assessment_student_skill on skill_assessment(student_id, skill_id);
create index idx_student_work_student on student_work(student_id);
create index idx_coach_note_student on coach_note(student_id);
create index idx_coach_note_coach on coach_note(coach_id);
create index idx_student_coach on student(coach_id);

-- ─── AUTH TRIGGER ────────────────────────────────────

create or replace function link_auth_to_student()
returns trigger as $$
begin
  update student
  set auth_user_id = new.id
  where email = new.email
    and auth_user_id is null;

  update coach
  set auth_user_id = new.id
  where email = new.email
    and auth_user_id is null;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function link_auth_to_student();
