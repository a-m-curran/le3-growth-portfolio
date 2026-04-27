/**
 * Observability logger for the LE3 Growth Portfolio.
 *
 * Writes to the `event_log` table — read the migration at
 * supabase/migrations/015_event_log.sql for schema rationale and
 * the philosophy of "log generously at pilot scale."
 *
 * Usage from any server-side code:
 *
 *   import { log } from '@/lib/observability/logger'
 *
 *   await log.info('conversation.started', {
 *     studentId,
 *     message: 'Phase 1 conversation initiated',
 *     context: { conversationId, workId },
 *   })
 *
 *   await log.error('llm.call_failed', {
 *     studentId,
 *     message: 'Anthropic API returned 500',
 *     context: { model: 'claude-sonnet-4', error: String(err) },
 *   })
 *
 * For LLM call sites and other operations where you want to wrap
 * a code block and have its duration + success/failure auto-logged,
 * use `log.span`:
 *
 *   const result = await log.span('llm.call', { studentId }, async () => {
 *     return callAnthropic(prompt)
 *   })
 *
 * The span helper records start/end + duration + thrown errors
 * automatically, so callers don't have to remember to log both paths.
 *
 * For request-correlated logging (multiple events from a single API
 * call), construct a child logger at the API route entry point:
 *
 *   const reqLogger = log.withRequest()  // generates a request_id
 *   await reqLogger.info(...)            // all events tagged with that id
 *
 * Failures inside the logger itself are swallowed and console.error'd
 * — never let observability break the actual code path.
 */

import { createAdminClient } from '@/lib/supabase-admin'

export type EventLevel = 'info' | 'warn' | 'error' | 'fatal'
export type ActorType = 'student' | 'coach' | 'system' | 'platform' | 'anonymous'

export interface LogEntry {
  /** Dot-namespaced event identifier, e.g. 'llm.call' or 'conversation.started' */
  eventType: string
  level?: EventLevel
  /** Short human-readable summary. Long detail goes in context. */
  message?: string
  /** Free-form structured data — always JSON-serializable */
  context?: Record<string, unknown>
  /**
   * Whose action this is. Defaults to 'system' for events emitted
   * outside an authenticated request.
   */
  actorType?: ActorType
  actorId?: string
  /** The student this event is ABOUT (even if the actor is a coach) */
  studentId?: string
  /** Correlation id for events from a single request */
  requestId?: string
  /** Operation duration in ms; usually set by `log.span` */
  durationMs?: number
}

interface LoggerOptions {
  defaultActorType?: ActorType
  defaultActorId?: string
  defaultStudentId?: string
  defaultRequestId?: string
}

class Logger {
  private opts: LoggerOptions

  constructor(opts: LoggerOptions = {}) {
    this.opts = opts
  }

  /**
   * Write a single log entry. Returns void; never throws — observability
   * failures are isolated from the calling code path.
   */
  async write(entry: LogEntry): Promise<void> {
    try {
      const admin = createAdminClient()

      // Truncate excessively large context payloads. LLM responses can
      // run several KB; cap at 32KB total context to keep rows
      // reasonable. If you need more, log to a separate object store.
      const context = entry.context ? truncateContext(entry.context) : {}

      await admin.from('event_log').insert({
        actor_type:
          entry.actorType || this.opts.defaultActorType || 'system',
        actor_id: entry.actorId || this.opts.defaultActorId || null,
        student_id: entry.studentId || this.opts.defaultStudentId || null,
        event_type: entry.eventType,
        level: entry.level || 'info',
        message: entry.message ? entry.message.slice(0, 1000) : null,
        context,
        request_id: entry.requestId || this.opts.defaultRequestId || null,
        duration_ms: entry.durationMs ?? null,
      })
    } catch (err) {
      // Logging must never break the calling code. Surface to console
      // (which Vercel + Trigger.dev capture) but don't propagate.
      console.error('[logger] failed to write event:', err, entry)
    }
  }

  // ─── Convenience methods per level ──────────────────────

  async info(eventType: string, fields: Omit<LogEntry, 'eventType' | 'level'> = {}) {
    return this.write({ ...fields, eventType, level: 'info' })
  }

  async warn(eventType: string, fields: Omit<LogEntry, 'eventType' | 'level'> = {}) {
    return this.write({ ...fields, eventType, level: 'warn' })
  }

  async error(eventType: string, fields: Omit<LogEntry, 'eventType' | 'level'> = {}) {
    return this.write({ ...fields, eventType, level: 'error' })
  }

  async fatal(eventType: string, fields: Omit<LogEntry, 'eventType' | 'level'> = {}) {
    return this.write({ ...fields, eventType, level: 'fatal' })
  }

  /**
   * Wrap an async block. Logs an entry on success or failure, with
   * duration. The wrapped function's return value is passed through.
   *
   * On failure, the original error is re-thrown so calling code can
   * still handle it — the log entry is a side-effect, not a substitute
   * for error handling.
   */
  async span<T>(
    eventType: string,
    fields: Omit<LogEntry, 'eventType' | 'level' | 'durationMs'>,
    fn: () => Promise<T>
  ): Promise<T> {
    const startedAt = Date.now()
    try {
      const result = await fn()
      await this.write({
        ...fields,
        eventType,
        level: 'info',
        durationMs: Date.now() - startedAt,
      })
      return result
    } catch (err) {
      await this.write({
        ...fields,
        eventType,
        level: 'error',
        durationMs: Date.now() - startedAt,
        message: fields.message || String(err),
        context: {
          ...(fields.context || {}),
          error_message: String(err),
          error_stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
        },
      })
      throw err
    }
  }

  // ─── Child loggers ──────────────────────────────────────

  /**
   * Returns a logger pre-configured with a generated request_id.
   * Use at the top of an API route handler to correlate every event
   * emitted during one request.
   */
  withRequest(requestId?: string): Logger {
    return new Logger({
      ...this.opts,
      defaultRequestId: requestId || generateRequestId(),
    })
  }

  /** Returns a logger pre-configured with a student id. */
  withStudent(studentId: string): Logger {
    return new Logger({ ...this.opts, defaultStudentId: studentId })
  }

  /** Returns a logger pre-configured with an actor id (coach or student). */
  withActor(actorType: ActorType, actorId: string): Logger {
    return new Logger({
      ...this.opts,
      defaultActorType: actorType,
      defaultActorId: actorId,
    })
  }

  /**
   * Most general extension — set arbitrary defaults on a new logger.
   * Useful when a caller has multiple defaults to set at once.
   */
  with(opts: LoggerOptions): Logger {
    return new Logger({ ...this.opts, ...opts })
  }
}

// ─── Singleton + helpers ─────────────────────────────────

export const log = new Logger()

/**
 * Generate a short, URL-safe correlation id. Doesn't need to be
 * cryptographically random — collision risk at our scale is zero.
 */
function generateRequestId(): string {
  // 12 random bytes → 16 char base64url string
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  // Fallback
  return Math.random().toString(36).slice(2, 18)
}

/**
 * Cap context size to keep rows manageable. Cuts string fields longer
 * than 16KB and total payload longer than ~32KB.
 */
function truncateContext(context: Record<string, unknown>): Record<string, unknown> {
  const PER_FIELD_CAP = 16_000
  const TOTAL_CAP = 32_000

  const result: Record<string, unknown> = {}
  let totalSize = 0

  for (const [key, value] of Object.entries(context)) {
    let v = value
    if (typeof v === 'string' && v.length > PER_FIELD_CAP) {
      v = v.slice(0, PER_FIELD_CAP) + '…[truncated]'
    }
    const stringified = typeof v === 'string' ? v : JSON.stringify(v)
    if (totalSize + (stringified?.length || 0) > TOTAL_CAP) {
      result[key] = '[truncated — total context exceeded cap]'
      break
    }
    totalSize += stringified?.length || 0
    result[key] = v
  }

  return result
}

/**
 * Common excerpt helper for LLM logging — extracts the first N chars
 * of a prompt or response so callers don't have to remember the cap.
 */
export function excerpt(s: string | undefined | null, n = 800): string | undefined {
  if (!s) return undefined
  return s.length > n ? s.slice(0, n) + '…' : s
}
