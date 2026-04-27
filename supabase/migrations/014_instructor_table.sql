-- Separate `instructor` from `coach` to reflect NLU's actual workflow.
--
-- LE3 program coaches and Brightspace course instructors are different
-- humans:
--
--   coach       — small, fixed group. Long-term mentors who advise
--                 students through the LE3 program. Manually managed
--                 by an admin. The portfolio is FOR them — they read
--                 student reflections, intervene on attention items.
--
--   instructor  — whoever is teaching a specific Brightspace course.
--                 Auto-pulled from each course's classlist on every
--                 sync. May rotate per quarter / per cohort.
--
-- Before this migration:
--   - sync auto-promoted any classlist user with role "Instructor"
--     into the `coach` table (Carrie Bliss got conflated this way)
--   - when a course's instructor wasn't in our DB yet, sync used
--     `pickDefaultCoachId` which falls back to "first active coach"
--     in the system — assigning real LE3 coaches (Elizabeth Chen)
--     as instructors of arbitrary courses
--
-- This migration:
--   1. Creates the `instructor` table.
--   2. Nulls out every existing `course.instructor_id`. The current
--      values are wrong (mix of legitimately-Carrie and
--      incorrectly-Elizabeth from the auto-promotion bug). The next
--      Valence sync, with the post-fix sync engine, will repopulate
--      correctly from classlist data.
--   3. Migrates Carrie Bliss specifically (by hard-coded UUID since
--      she's the only known mistakenly-promoted instructor in the
--      current data) into the new instructor table, preserving her
--      UUID.
--   4. Repoints course.instructor_id's FK from coach → instructor.
--   5. Deletes Carrie from coach.
--
-- Real LE3 coaches (Elizabeth Chen, Angelica Morales, Andrew Curran)
-- stay in the coach table untouched.

create table instructor (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  d2l_user_id text,
  org_defined_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index instructor_email_idx on instructor (lower(email));
create index instructor_d2l_user_id_idx on instructor (d2l_user_id) where d2l_user_id is not null;

update course set instructor_id = null where instructor_id is not null;

insert into instructor (id, name, email, status, created_at, updated_at)
select id, name, email, status, created_at, now()
from coach
where id = 'e588a9df-60db-4316-9b2b-69f42daa1a69';

do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'course'::regclass
    and contype = 'f'
    and array_length(conkey, 1) = 1
    and conkey[1] = (
      select attnum from pg_attribute
      where attrelid = 'course'::regclass and attname = 'instructor_id'
    );
  if fk_name is not null then
    execute format('alter table course drop constraint %I', fk_name);
  end if;
end$$;

alter table course
  add constraint course_instructor_id_fkey
  foreign key (instructor_id) references instructor(id) on delete set null;

delete from coach where id = 'e588a9df-60db-4316-9b2b-69f42daa1a69';

alter table instructor enable row level security;

comment on table instructor is 'Brightspace course instructors. Auto-populated by Valence sync from classlist rows where ClasslistRoleDisplayName = Instructor. Distinct from `coach`, which holds LE3 program coaches.';
comment on column instructor.d2l_user_id is 'Brightspace user identifier. Same shape as student.d2l_user_id.';
