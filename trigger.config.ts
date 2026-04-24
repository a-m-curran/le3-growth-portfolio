import { defineConfig } from '@trigger.dev/sdk'

/**
 * Trigger.dev v4 project configuration.
 *
 * To deploy tasks to this project, run:
 *
 *   npx trigger.dev@latest login    (first time only)
 *   npx trigger.dev@latest deploy   (from repo root)
 *
 * Tasks live in src/trigger/. Currently:
 *   - sync-le3: Walks the configured LE3 org unit via Valence and pulls
 *     courses, rosters, assignments, and submissions into Supabase.
 *     Triggered manually via /api/admin/sync-le3 or on a schedule
 *     configured in the Trigger.dev dashboard.
 *
 * Environment variables the tasks need at runtime (set these in the
 * Trigger.dev dashboard under Environment Variables):
 *
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY          (used by the auto-tagger)
 *   D2L_VALENCE_INSTANCE_URL
 *   D2L_VALENCE_CLIENT_ID
 *   D2L_VALENCE_CLIENT_SECRET
 *   D2L_VALENCE_TOKEN_URL
 *   D2L_VALENCE_API_VERSION    (optional)
 *   D2L_VALENCE_LE3_ORG_UNIT_ID
 */
export default defineConfig({
  project: 'proj_hjxwfqkuakbcxrzabspr',
  runtime: 'node',
  dirs: ['./src/trigger'],

  // Log level for task runs. "info" is sensible for production;
  // bump to "debug" during pilot troubleshooting.
  logLevel: 'info',

  build: {
    // Externalize packages the bundler struggles with — they'll be
    // installed at runtime from package.json instead of being inlined
    // into the task bundle.
    //
    //   mammoth    — .docx text extraction. Dynamic-imported in
    //                extract-text.ts; without this external declaration,
    //                Trigger.dev's bundler was silently dropping it,
    //                causing extractText to throw at runtime and every
    //                student_work row to land with content_len=0.
    //   pdf-parse  — .pdf text extraction. Same shape: dynamic require,
    //                awkward dep tree (it reads a test PDF at module
    //                load in non-production), safer at runtime.
    external: ['mammoth', 'pdf-parse'],
  },

  // Default retry policy for tasks that don't override it.
  // The sync task has its own retry config in src/trigger/sync-le3.ts
  // and will use that instead.
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 60_000,
      factor: 2,
      randomize: true,
    },
  },

  // Cap the default task duration. Individual tasks can override with
  // maxDuration in their task definition. sync-le3 sets 1800s (30 min).
  maxDuration: 1800,
})
