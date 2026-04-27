-- Centralized observability event log.
--
-- Per-domain logs already exist (`sync_run` for Valence sync runs,
-- `lti_launch_log` for LTI launch attempts). This table is for
-- everything else: LLM calls, conversation lifecycle, work submission,
-- auth events, coach actions, and any unexpected error surface.
--
-- The goal is forward-looking observability for a small (~50 student)
-- pilot population: when a student emails their coach saying "this
-- felt weird," the coach can look at the event log filtered to that
-- student and see exactly what happened — including the LLM prompts
-- and responses that produced any odd output.
--
-- At pilot scale, log generously. We can rotate / archive once volume
-- justifies it. Until then, more rows = more debuggability.

create table event_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),

  actor_type text not null check (
    actor_type in ('student', 'coach', 'system', 'platform', 'anonymous')
  ),
  actor_id text,

  student_id uuid references student(id) on delete set null,

  event_type text not null,

  level text not null default 'info' check (
    level in ('info', 'warn', 'error', 'fatal')
  ),

  message text,
  context jsonb default '{}'::jsonb,
  request_id text,
  duration_ms integer
);

create index event_log_occurred_at_desc_idx
  on event_log (occurred_at desc);

create index event_log_student_id_occurred_at_idx
  on event_log (student_id, occurred_at desc)
  where student_id is not null;

create index event_log_level_occurred_at_idx
  on event_log (level, occurred_at desc)
  where level in ('error', 'fatal');

create index event_log_event_type_idx
  on event_log (event_type, occurred_at desc);

create index event_log_request_id_idx
  on event_log (request_id)
  where request_id is not null;

alter table event_log enable row level security;

comment on table event_log is 'General-purpose observability log. Routine writes. Use the logger utility in src/lib/observability/logger.ts rather than inserting directly so events stay schema-consistent.';
comment on column event_log.event_type is 'Dot-namespaced. Established prefixes: llm.* | conversation.* | work.* | auth.* | coach.* | system.* | sync.* | lti.*';
comment on column event_log.context is 'Free-form structured data. LLM events should include {model, prompt_excerpt, response_excerpt, tokens_*}. Error events should include {error_message, stack}.';
comment on column event_log.request_id is 'Edge-generated correlation id, threaded through async work. NULL for system-emitted events with no triggering request.';
