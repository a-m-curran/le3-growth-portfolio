-- Generalize auth_passlink to support student subjects (pilot bridge).
--
-- 017 created auth_passlink with coach_id NOT NULL — coach-only by
-- design. The pilot must onboard students before NLU IT can embed the
-- LTI launch in D2L, so a per-student login link is needed. This
-- generalizes the subject to (coach_id XOR student_id): exactly one is
-- set per row. Existing coach rows / queries / scripts are unaffected
-- (the coach_id path is unchanged; only its NOT NULL is relaxed).
--
-- Reversible: drop the student_id column + index + constraint and
-- restore `alter column coach_id set not null` (every existing row has
-- a non-null coach_id, so the restore is safe).

alter table auth_passlink
  add column student_id uuid references student(id) on delete cascade;

alter table auth_passlink
  alter column coach_id drop not null;

alter table auth_passlink
  add constraint auth_passlink_one_subject
  check ((coach_id is not null) <> (student_id is not null));

create index auth_passlink_student_active_idx
  on auth_passlink (student_id)
  where revoked_at is null;

comment on column auth_passlink.student_id is 'Student subject (XOR coach_id, enforced by auth_passlink_one_subject). Student passlinks land /v2/today as role:student. Pilot bridge until LTI embedding.';
comment on constraint auth_passlink_one_subject on auth_passlink is 'Exactly one of coach_id / student_id is set per row (polymorphic subject).';
