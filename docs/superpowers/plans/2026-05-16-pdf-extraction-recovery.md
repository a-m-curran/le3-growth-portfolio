# PDF Extraction Fix + Empty-Row Recovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `pdf-parse@2.x` extractor with `unpdf`, then add a one-time, zero-write-discipline Trigger.dev fan-out task that re-fetches and re-extracts the historical `student_work` rows the PDF bug left empty.

**Architecture:** One small swap in the shared `extract-text.ts` (fixes all future syncs). A framework-agnostic recovery core (`src/lib/recovery/recover-extractions.ts`) does READ-only enumeration + a single content-only `UPDATE` per recovered row; two thin Trigger.dev tasks (`recover-empty-extractions` parent → `recover-course` child) mirror the existing `sync-le3`/`sync-course` fan-out and reuse its rate-limit/checkpoint infra; an admin-gated route + a Tools panel trigger it. Dry-run is the default and reports counts by ground-truth file type before any write.

**Tech Stack:** TypeScript, Next.js 14 (app router), Supabase (`@supabase/supabase-js` service-role admin client), Trigger.dev v4 (`@trigger.dev/sdk`, `schemaTask`, `batchTriggerAndWait`), `unpdf` (PDF text extraction), `tsx` test scripts with the existing `mock-valence` harness.

**Spec:** `docs/superpowers/specs/2026-05-16-pdf-extraction-recovery-design.md`

---

## Spec deviation to know before starting

The spec says the recovery `UPDATE` sets `content` **and clears `extractionError`**. There is **no `extraction_error` column on `student_work`** (verified against `supabase/migrations/001_initial_schema.sql` + `005` + `011`). Extraction failures are recorded only in `sync_run.error_details` (an in-memory `ProcessSubmissionResult.extractionError` pushed to the run row — see `src/lib/sync/sync-course.ts:494-496,175-181`). Therefore the recovery write is **`content`-only**. This keeps the zero-write surface to exactly one `.update({ content })` and is the correct behavior; `sync_run` history is intentionally left untouched (spec: "no sync_run row").

## File Structure

- **Modify** `src/lib/extract-text.ts` — swap `extractPdf` from `pdf-parse` to `unpdf` (dynamic import, aliased).
- **Modify** `package.json` — add `unpdf`, remove `pdf-parse` + `@types/pdf-parse`.
- **Modify** `trigger.config.ts` — add `unpdf` to `build.external`; rewrite the stale `pdf-parse` comment.
- **Create** `src/lib/recovery/recover-extractions.ts` — recovery core: `parseWorkExternalId`, `listEmptyWorkOrgUnits`, `recoverCourseExtractions`, `aggregateRecoveryResults`, types. The only DB write in the whole feature lives here (one content `UPDATE`, gated by `!dryRun`).
- **Create** `src/trigger/recover-course.ts` — child Trigger task `recover-course` (thin wrapper over `recoverCourseExtractions`; mirrors `src/trigger/sync-course.ts`).
- **Create** `src/trigger/recover-empty-extractions.ts` — parent Trigger task (enumerate org units → `batchTriggerAndWait` children → aggregate; mirrors `src/trigger/sync-le3.ts`, no `sync_run` row).
- **Create** `src/app/api/admin/recover-extractions/route.ts` — admin-gated POST that enqueues the parent (mirrors `src/app/api/admin/sync-le3/route.ts` + adds an `isAdminEmail` defense-in-depth check).
- **Create** `src/components/coach/RecoverExtractionsPanel.tsx` — self-contained client panel (dry-run-first button + summary readout; mirrors the existing `@/components/coach/*` panel pattern).
- **Modify** `src/app/v2/(coach)/coach/tools/ToolsView.tsx` — mount `<RecoverExtractionsPanel />` under the Sync tab.
- **Create** `scripts/test-extract-text.ts` — standalone regression test (no DB): a verified inline base64 PDF must extract to known text.
- **Create** `scripts/test-recover-extractions.ts` — structural (zero-write) + behavioral (mock-valence, in-process) + dry-run + route-401 tests, following the `scripts/test-sync-*.ts` convention.

There is **no `npm test`** in this repo; the established convention is per-script `npx tsx scripts/test-*.ts` (see `scripts/test-sync-course.ts`). This plan follows that convention exactly — do not invent a test runner.

---

### Task 1: Swap PDF extractor to `unpdf` + regression test

**Files:**
- Create: `scripts/test-extract-text.ts`
- Modify: `src/lib/extract-text.ts:41-46`
- Modify: `package.json:11-40`
- Modify: `trigger.config.ts:39-64`

- [ ] **Step 1: Write the failing regression test**

Create `scripts/test-extract-text.ts` with exactly this content. The base64 string is a minimal, real PDF that was generated and verified to extract to `"Hello LE3 recovery"` with `unpdf@1.6.2`.

```ts
/**
 * Regression test for src/lib/extract-text.ts.
 *
 * Guards the exact gap that let the PDF-extraction bug ship: there was
 * no test that a real PDF actually extracts. SAMPLE_PDF_B64 is a
 * minimal, structurally-valid PDF whose text is "Hello LE3 recovery".
 *
 * No DB, no env, no network — pure function.
 *
 * USAGE:
 *   npx tsx scripts/test-extract-text.ts
 */

import { extractText } from '@/lib/extract-text'

// Minimal valid PDF (Catalog/Pages/Page/Contents/Font + correct xref).
// Verified: unpdf@1.6.2 extractText → "Hello LE3 recovery".
const SAMPLE_PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0OSA+PgpzdHJlYW0KQlQgL0YxIDE4IFRmIDIwIDEwMCBUZCAoSGVsbG8gTEUzIHJlY292ZXJ5KSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDM0MCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQxMAolJUVPRg=='

let passed = 0
let failed = 0

function ok(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
    if (detail) console.error(`    ${detail}`)
  }
}

async function main(): Promise<void> {
  console.log('\n\x1b[1;36m━━━ extractText: real PDF ━━━\x1b[0m')
  const buf = Buffer.from(SAMPLE_PDF_B64, 'base64')
  let text = ''
  let threw: unknown = null
  try {
    text = await extractText(buf, 'sample.pdf')
  } catch (e) {
    threw = e
  }
  ok(threw === null, 'extractText(pdf) does not throw', String(threw))
  ok(text.includes('Hello LE3 recovery'), 'extracted text contains the PDF body', JSON.stringify(text))

  console.log('\n\x1b[1;36m━━━ extractText: unsupported type ━━━\x1b[0m')
  const empty = await extractText(Buffer.from('binary'), 'image.png')
  ok(empty === '', 'unsupported extension returns empty string', JSON.stringify(empty))

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
```

- [ ] **Step 2: Run the test — verify it FAILS on the current `pdf-parse` code**

Run: `npx tsx scripts/test-extract-text.ts`

Expected: FAIL. The current `extractPdf` does `const pdfParse = require('pdf-parse')` and `pdf-parse@2.4.5` does not export a callable default, so `extractText` throws `pdfParse is not a function` (or a `DOMMatrix is not defined` pdf.js error). Output shows `✗ extractText(pdf) does not throw` and a non-zero exit.

- [ ] **Step 3: Add `unpdf`, remove `pdf-parse`**

Run: `npm install unpdf@^1.6.2 && npm uninstall pdf-parse @types/pdf-parse`

This adds `unpdf` to `dependencies` and removes both `pdf-parse` and `@types/pdf-parse` from `package.json`. Verify `package.json` no longer references `pdf-parse` and now lists `"unpdf": "^1.6.2"` under `dependencies`.

- [ ] **Step 4: Rewrite `extractPdf` to use `unpdf`**

In `src/lib/extract-text.ts`, replace the whole `extractPdf` function (lines 41-46):

```ts
async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buffer)
  return result.text
}
```

with:

```ts
async function extractPdf(buffer: Buffer): Promise<string> {
  // unpdf ships a no-DOM serverless build of pdf.js and is ESM-only, so
  // it is dynamic-imported here exactly like mammoth below. This replaced
  // pdf-parse@2.x, which required the DOMMatrix browser global and a
  // Node range that excluded Trigger.dev's Node 21.7.3 sandbox — every
  // synced PDF landed with empty content as a result. (Alias unpdf's
  // extractText so it does not shadow this module's own extractText.)
  const { extractText: extractPdfText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractPdfText(pdf, { mergePages: true })
  return text
}
```

- [ ] **Step 5: Externalize `unpdf` in the Trigger build config + fix the stale comment**

In `trigger.config.ts`, replace the entire `build: { ... }` block (lines 39-64) with:

```ts
  build: {
    // Externalize packages the bundler struggles with — they'll be
    // installed at runtime from package.json instead of being inlined
    // into the task bundle.
    //
    //   mammoth — .docx text extraction. Dynamic-imported in
    //             extract-text.ts; without this external declaration,
    //             Trigger.dev's bundler was silently dropping it,
    //             causing extractText to throw at runtime and every
    //             student_work row to land with content_len=0.
    //
    //   unpdf  — .pdf text extraction (no-DOM serverless pdf.js build).
    //             ESM-only and dynamic-imported in extract-text.ts, so
    //             it follows the same external+dynamic-import pattern as
    //             mammoth. Replaced pdf-parse@2.4.5, which required Node
    //             ">=20.16.0 <21 || >=22.3.0" while Trigger.dev's
    //             managed container runs Node 21.7.3, and needed the
    //             DOMMatrix browser global — together those left every
    //             synced PDF with empty content. unpdf supports Node 18+
    //             with no native deps, so a runtime install on Node 21
    //             is safe.
    external: ['mammoth', 'unpdf'],
  },
```

- [ ] **Step 6: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-extract-text.ts`

Expected: PASS — `3 passed, 0 failed`, exit 0 (`extractText(pdf) does not throw`, `extracted text contains the PDF body`, `unsupported extension returns empty string`).

- [ ] **Step 7: Typecheck**

Run: `npm run build`

Expected: build succeeds (Next.js compiles, no TypeScript errors). If it fails on an unrelated pre-existing issue, note it and continue; it must not fail on `extract-text.ts`, `package.json`, or `trigger.config.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/extract-text.ts package.json package-lock.json trigger.config.ts scripts/test-extract-text.ts
git commit -m "$(cat <<'EOF'
extract-text: replace broken pdf-parse@2 with unpdf + regression test

pdf-parse@2.4.5 needed the DOMMatrix browser global and a Node range
excluding Trigger.dev's Node 21.7.3, so every synced PDF landed empty.
unpdf ships a no-DOM serverless pdf.js build, dynamic-imported and
externalized like mammoth. Adds the missing real-PDF extraction test.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Recovery core — `parseWorkExternalId` + `listEmptyWorkOrgUnits`

**Files:**
- Create: `src/lib/recovery/recover-extractions.ts`
- Create: `scripts/test-recover-extractions.ts`

- [ ] **Step 1: Write the failing test (pure-function section)**

Create `scripts/test-recover-extractions.ts`. This file grows over Tasks 2, 3, 6 and the route-401 test; start it with the env/scaffold and the `parseWorkExternalId` section. The scaffold mirrors `scripts/test-sync-course.ts` (env stubs, mock-valence, mock-row cleanup).

```ts
/**
 * Tests for the empty-extraction recovery feature.
 *
 *   1. parseWorkExternalId         — pure
 *   2. listEmptyWorkOrgUnits       — READ-only enumeration (mock rows)
 *   3. recoverCourseExtractions    — behavioral, mock-valence, in-process
 *   4. recoverCourseExtractions    — dry-run writes nothing
 *   5. structural zero-write       — source scan of the write modules
 *   6. route auth                  — unauthenticated POST → 401
 *
 * USAGE:
 *   npx tsx scripts/test-recover-extractions.ts
 */

import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '..', '.env.local'), override: true })

process.env.D2L_VALENCE_INSTANCE_URL = 'https://mock.brightspace.test'
process.env.D2L_VALENCE_CLIENT_ID = 'mock-client-id'
process.env.D2L_VALENCE_CLIENT_SECRET = 'mock-client-secret'
process.env.D2L_VALENCE_TOKEN_URL = 'https://auth.brightspace.test/core/connect/token'
process.env.D2L_VALENCE_API_VERSION = '1.82'
process.env.D2L_VALENCE_LE3_ORG_UNIT_ID = '1001'
process.env.LTI_TOOL_URL = 'https://mock.le3.test'
process.env.LTI_KEY_ID = 'mock-key-2026'
process.env.LTI_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCNhjvKe89npm0k\nvGiZZCdNTY+KMpXK8q5pCySHp8ILyL281BKqRrXQ6fIoadAklfGMC0IMJzGyy2xn\nBAvewaC8HuSxX4gq+v4pKC6FAe5j1jlb5oenCSaJiefSbV/lrc/TxxHMVf5NwfWl\ni2m3KuYexpbt+qnIqlOOTdUaWx2639xOg0Yzm8NcEz3VIkm9VMCyu1J7TW6sV8cI\ngmru5RPb12bQEl0oZatakXsKdp3WLXEjbsZTMcDbvS64y0bEdYFDF8iGlt74q/8p\nWjmHjHtiYsDHz0LGXpLx8Pg3TS8ibzBdNo+cxGYacTefmpqgNGCx9e5pIDARQRLC\nQ7zrVSrPAgMBAAECggEAOH4TQu3uKilIWwgsVsKgX56sxBUSLyt1THAKum3QKyUL\n/CLJepf0PrsME269i8Ug4O6jhDdnAsBp+qsmU9qF32ITluwT7lg3eVVVUHmnX8nl\nJpacoqQn8nIOjDRluciKc7Z8l8zh0McyV80RO3EP38wU9lT/Th8TcHQIM1eYw/29\nMLXEDgmO+Ki/OmFeC880xpEb5qOAMJIXDGAfAVT8Wb3H9DdyxhU7KGz5aVlnx/9U\nrwiJXtfSNtvjXPqX21JqHEGSUcRZYueAXvl5MFgWa1lsD4RcZic4uKhoXnFKdsCB\n9ulekkL+kxrAAzCZVK+fS8PCYhNkYlzXA75gbEzo6QKBgQDDJhweojjfreuZZrdb\nX6m/3ZWCk8ijrEBQXWnYwwtn6cIpk+SaJAbf3H+s1qlZVBy1Zs+ZGpV4A8ZdisPr\nvAkeoTdbXL8e8Qu0+Exr6yx8VE3SZjZ4LeS9pDxrRg0fjxJMa9FiEkO2RU6pegQm\n0xTMCB8P7AWi2Vm24bqOk6LlBwKBgQC5p4KrY4O170ggj/AWI2k1PMyoztIJ1r0/\nYlUY1BjA8ZFjmGBJIqM253czuy88f9fIjrW1km6VpTCVyBiPgACmV9dAZS6QF4Ju\nSVz84favNra3A5sDeaFLo4tpOJJz7ZPyodQ2R0YirBXi755EHM8kXkNzRdTFFmyt\nG5WIrY2h+QKBgQC9Fto8XJebNRyKYVrdMM58WKqcAbJx1V/j/v+mxybwIzK9ss3Z\nBXubwj38LWueYMAIjXwuL/IQfifhT6oTavmzMic/YZjW1F2xlr4F+7P5LH7TlbLF\ntEJl9xOMJi5lG+5xGi+iRWxS2skjslT/gZwvLtdaSCoV52DkschginFWVQKBgQCc\n0PZZyHQPcC9vecVlHcIXOuTwTcoyj1VJPcj9cOH7z9Br3OCvxfcxQDB63MiYhLAC\n8zBfT3HjKyYvzlWYmJlz6EykUxMSmRkOCR/nZwKUm1WYnw4H0GxC1MDEPwnNrEbE\nspbqxidi0BKonpgDloYNhSXaL4j6dOeVDPCxA0/YGQKBgQCHoEQo5jTTdNrqkweN\n24QObNjw0KjEeH1kkmXpVaHQXfvdQbUMxKt/TtQBm7/wtn5d1YI3XyPAuu56gD0W\ntSuCnTWU3qmNgJHwqPbEFI2ULbXjw0ZZbYum5cJESKMqmxb4G0fjxaCJnWpDri9o\n8u2ZVBJpHn0ertpRd8Yyms5AXw==\n-----END PRIVATE KEY-----'
process.env.LTI_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjYY7ynvPZ6ZtJLxomWQn\nTU2PijKVyvKuaQskh6fCC8i9vNQSqka10OnyKGnQJJXxjAtCDCcxsstsZwQL3sGg\nvB7ksV+IKvr+KSguhQHuY9Y5W+aHpwkmiYnn0m1f5a3P08cRzFX+TcH1pYtptyrm\nHsaW7fqpyKpTjk3VGlsdut/cToNGM5vDXBM91SJJvVTAsrtSe01urFfHCIJq7uUT\n29dm0BJdKGWrWpF7Cnad1i1xI27GUzHA270uuMtGxHWBQxfIhpbe+Kv/KVo5h4x7\nYmLAx89Cxl6S8fD4N00vIm8wXTaPnMRmGnE3n5qaoDRgsfXuaSAwEUESwkO861Uq\nzwIDAQAB\n-----END PUBLIC KEY-----'

import {
  installMockValence,
  uninstallMockValence,
  MOCK_STATS,
} from '@/lib/d2l/__mocks__/mock-valence'
import { createAdminClient } from '@/lib/supabase-admin'
import { clearValenceTokenCache } from '@/lib/d2l/auth'
import { listCoursesUnderOrgUnit } from '@/lib/d2l'
import { syncOneCourse } from '@/lib/sync/sync-course'
import {
  parseWorkExternalId,
  listEmptyWorkOrgUnits,
  recoverCourseExtractions,
} from '@/lib/recovery/recover-extractions'

const MOCK_COURSE_ORG_UNIT_IDS = ['2001', '2002']
const MOCK_ASSIGNMENT_FOLDER_IDS = ['3001', '3002', '3003', '3004', '3005']
const MOCK_EMAIL_DOMAIN_PATTERN = '%@mock.test'

let passed = 0
let failed = 0

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`) }
  else {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`    expected: ${JSON.stringify(expected)}`)
    console.error(`    actual:   ${JSON.stringify(actual)}`)
  }
}
function assertTrue(cond: boolean, label: string, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}`); if (detail) console.error(`    ${detail}`) }
}
function section(t: string): void {
  console.log(`\n\x1b[1;36m━━━ ${t} ━━━\x1b[0m`)
}

async function ensureMockCoach(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const email = 'mock-coach@mock.test'
  const { data: existing } = await admin.from('coach').select('id').eq('email', email).maybeSingle()
  if (existing) return existing.id as string
  const { data: inserted, error } = await admin
    .from('coach').insert({ name: 'Mock Coach', email, status: 'active' }).select('id').single()
  if (error || !inserted) throw new Error(`Failed to insert mock coach: ${error?.message}`)
  return inserted.id as string
}

async function cleanupMockData(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  const { data: mockStudents } = await admin
    .from('student').select('id').like('email', MOCK_EMAIL_DOMAIN_PATTERN)
  const ids = (mockStudents || []).map(s => s.id)
  if (ids.length > 0) await admin.from('student_work').delete().in('student_id', ids)
  await admin.from('assignment').delete().in('brightspace_folder_id', MOCK_ASSIGNMENT_FOLDER_IDS)
  await admin.from('course').delete().in('brightspace_org_unit_id', MOCK_COURSE_ORG_UNIT_IDS)
  await admin.from('student').delete().like('email', MOCK_EMAIL_DOMAIN_PATTERN)
  await admin.from('coach').delete().like('email', MOCK_EMAIL_DOMAIN_PATTERN)
}

async function main(): Promise<void> {
  const admin = createAdminClient()

  section('parseWorkExternalId (pure)')
  assertEqual(
    JSON.stringify(parseWorkExternalId('d2l:2001:3001:7000')),
    JSON.stringify({ orgUnitId: '2001', folderId: '3001', submissionId: '7000' }),
    'valid d2l external_id parses to {orgUnitId,folderId,submissionId}'
  )
  assertEqual(parseWorkExternalId('lti:abc'), null, 'non-d2l external_id → null')
  assertEqual(parseWorkExternalId('d2l:2001:3001'), null, 'too few segments → null')
  assertEqual(parseWorkExternalId(null), null, 'null external_id → null')

  // Tasks 3, 4, 6 and the route-401 test append their sections below.
  // (placeholder removed as each task is implemented)

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
void cleanupMockData
void ensureMockCoach
void installMockValence
void uninstallMockValence
void clearValenceTokenCache
void listCoursesUnderOrgUnit
void syncOneCourse
void MOCK_STATS
void listEmptyWorkOrgUnits
void recoverCourseExtractions
void readFileSync
main()
```

> The `void ...` lines keep unused imports from breaking the build while later tasks are still pending; each is removed as its section is added.

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: FAIL — module `@/lib/recovery/recover-extractions` does not exist (`Cannot find module`).

- [ ] **Step 3: Create the recovery core with `parseWorkExternalId` + `listEmptyWorkOrgUnits`**

Create `src/lib/recovery/recover-extractions.ts`:

```ts
/**
 * Empty-extraction recovery — framework-agnostic core.
 *
 * The PDF-extraction bug (pdf-parse@2 under Trigger.dev's Node 21
 * sandbox) left ~1.3k synced student_work rows with empty content.
 * Raw submission buffers were never persisted, so recovery must
 * re-fetch from D2L. This module:
 *
 *   - parseWorkExternalId    parse d2l:{ou}:{folder}:{submission}
 *   - listEmptyWorkOrgUnits  READ-only: distinct org units that still
 *                            have empty d2l_valence_sync rows
 *   - recoverCourseExtractions  per-course: re-list folder → match
 *                            submission → download first file →
 *                            re-extract with the (fixed) extractor →
 *                            single content-only UPDATE (unless dryRun)
 *   - aggregateRecoveryResults  sum child results into one summary
 *
 * WRITE DISCIPLINE (load-bearing): the ONLY database write in this
 * feature is the single `.update({ content })` in
 * recoverCourseExtractions, gated by `!dryRun`. No insert/upsert/delete
 * anywhere; no other table; no sync_run row. scripts/test-recover-
 * extractions.ts asserts this by source scan.
 *
 * runAutoTag is a seam (default false): when false the LLM auto-tag
 * branch is skipped entirely (no cost, no work_skill_tag writes). The
 * branch body is intentionally NOT implemented yet (YAGNI; spec
 * out-of-scope) — enabling it later is an additive change, not a
 * rewrite.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listAssignmentSubmissions,
  downloadSubmissionFile,
} from '@/lib/d2l'
import { extractText, isSupported } from '@/lib/extract-text'

const PAGE = 1000

export interface WorkCoords {
  orgUnitId: string
  folderId: string
  submissionId: string
}

export interface CourseRecoveryResult {
  orgUnitId: string
  scanned: number
  recovered: number
  stillEmpty: {
    unsupported: number
    noFile: number
    submissionGone: number
    emptyText: number
    downloadError: number
  }
  errors: string[]
}

export interface RecoverySummary {
  orgUnitsProcessed: number
  scanned: number
  recovered: number
  stillEmpty: CourseRecoveryResult['stillEmpty']
  errorCount: number
  perCourse: CourseRecoveryResult[]
}

/** Parse a student_work.external_id of the form d2l:{ou}:{folder}:{submission}. */
export function parseWorkExternalId(externalId: string | null): WorkCoords | null {
  if (!externalId) return null
  const parts = externalId.split(':')
  if (parts.length !== 4) return null
  if (parts[0] !== 'd2l') return null
  const [, orgUnitId, folderId, submissionId] = parts
  if (!orgUnitId || !folderId || !submissionId) return null
  return { orgUnitId, folderId, submissionId }
}

function isEmpty(content: string | null): boolean {
  return !content || content.trim().length === 0
}

/**
 * READ-ONLY. Distinct org unit ids that still have at least one empty
 * (`content` null/blank) `student_work` row sourced from the D2L sync.
 * Paginated select; JS-side empty filter (robust vs PostgREST empty-
 * string quoting).
 */
export async function listEmptyWorkOrgUnits(
  admin: SupabaseClient
): Promise<string[]> {
  const orgUnits = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('student_work')
      .select('external_id, content')
      .eq('source', 'd2l_valence_sync')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`listEmptyWorkOrgUnits select failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (!isEmpty(row.content as string | null)) continue
      const coords = parseWorkExternalId(row.external_id as string | null)
      if (coords) orgUnits.add(coords.orgUnitId)
    }
    if (data.length < PAGE) break
  }
  return Array.from(orgUnits)
}
```

- [ ] **Step 4: Add the `listEmptyWorkOrgUnits` test section**

In `scripts/test-recover-extractions.ts`, replace the line
`  // Tasks 3, 4, 6 and the route-401 test append their sections below.`
and the line below it with:

```ts
  section('listEmptyWorkOrgUnits (READ-only enumeration)')
  await cleanupMockData(admin)
  const coachId = await ensureMockCoach(admin)
  // Seed one mock student + two student_work rows: one empty
  // (d2l_valence_sync, content=null) under org 2001, one non-empty.
  const { data: stu } = await admin.from('student').insert({
    nlu_id: 'd2l:mock-empty-1', d2l_user_id: 'mock-empty-1',
    first_name: 'Empty', last_name: 'Case', email: 'empty-case@mock.test',
    coach_id: coachId, cohort: 'Spring 2026',
    program_start_date: '2026-01-01', status: 'active',
  }).select('id').single()
  const studentId = stu!.id as string
  await admin.from('student_work').insert([
    {
      student_id: studentId, title: 'Empty One', work_type: 'other',
      submitted_at: new Date().toISOString(), quarter: 'Spring 2026',
      content: null, source: 'd2l_valence_sync',
      external_id: 'd2l:2001:3001:999001',
    },
    {
      student_id: studentId, title: 'Has Text', work_type: 'other',
      submitted_at: new Date().toISOString(), quarter: 'Spring 2026',
      content: 'already extracted', source: 'd2l_valence_sync',
      external_id: 'd2l:2002:3004:999002',
    },
  ])
  const ous = await listEmptyWorkOrgUnits(admin)
  assertTrue(ous.includes('2001'), 'org 2001 (empty row) is enumerated')
  assertTrue(!ous.includes('2002'), 'org 2002 (non-empty row) is NOT enumerated')
  await cleanupMockData(admin)
```

Also remove the now-unused guards `void listEmptyWorkOrgUnits`, `void cleanupMockData`, `void ensureMockCoach` from the bottom of the file (they are now genuinely used).

- [ ] **Step 5: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: PASS for the `parseWorkExternalId` and `listEmptyWorkOrgUnits` sections (remaining `void` guards keep the rest inert). `N passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recovery/recover-extractions.ts scripts/test-recover-extractions.ts
git commit -m "$(cat <<'EOF'
recovery: external_id parser + read-only empty-row org enumeration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Recovery core — `recoverCourseExtractions` (per-course worker)

**Files:**
- Modify: `src/lib/recovery/recover-extractions.ts` (append `recoverCourseExtractions`)
- Modify: `scripts/test-recover-extractions.ts` (add behavioral section)

- [ ] **Step 1: Write the failing behavioral test section**

In `scripts/test-recover-extractions.ts`, immediately after the `listEmptyWorkOrgUnits` section's final `await cleanupMockData(admin)`, add:

```ts
  section('recoverCourseExtractions — repopulates an emptied row (mock-valence)')
  await cleanupMockData(admin)
  installMockValence()
  clearValenceTokenCache()
  try {
    // Realistic setup: sync mock course 2001 so student_work rows exist
    // exactly as production creates them.
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const c2001 = courses.find(c => c.orgUnitId === '2001')!
    const mc = await ensureMockCoach(admin)
    const synced = await syncOneCourse({
      syncRunId: 'recover-test', course: c2001, mode: 'full', defaultCoachId: mc,
    })
    assertTrue(synced.counts.submissionsSynced >= 1, 'mock 2001 synced >= 1 work row')

    // Pick one synced row and null its content to simulate a PDF-bug row.
    const { data: mockStudents } = await admin
      .from('student').select('id').like('email', MOCK_EMAIL_DOMAIN_PATTERN)
    const sids = (mockStudents || []).map(s => s.id)
    const { data: target } = await admin
      .from('student_work')
      .select('id, content, external_id')
      .in('student_id', sids)
      .eq('source', 'd2l_valence_sync')
      .like('external_id', 'd2l:2001:%')
      .not('content', 'is', null)
      .limit(1)
      .single()
    const targetId = target!.id as string
    const originalText = target!.content as string
    assertTrue(originalText.length > 0, 'target row had real extracted text before')

    await admin.from('student_work').update({ content: null }).eq('id', targetId)

    // Snapshot work_skill_tag count for this row (seam OFF must not add tags).
    const tagCount = async (): Promise<number> => {
      const { count } = await admin
        .from('work_skill_tag')
        .select('work_id', { count: 'exact', head: true })
        .eq('work_id', targetId)
      return count || 0
    }
    const tagsBefore = await tagCount()
    const { count: worksBefore } = await admin
      .from('student_work').select('id', { count: 'exact', head: true }).in('student_id', sids)

    const res = await recoverCourseExtractions({
      admin, orgUnitId: '2001', dryRun: false, runAutoTag: false,
    })
    assertEqual(res.recovered, 1, 'exactly one row recovered')
    assertEqual(res.orgUnitId, '2001', 'result reports org 2001')

    const { data: after } = await admin
      .from('student_work').select('content').eq('id', targetId).single()
    assertEqual(after!.content, originalText, 'content repopulated to the original extracted text')

    const tagsAfter = await tagCount()
    assertEqual(tagsAfter, tagsBefore, 'seam OFF → no work_skill_tag rows added')
    const { count: worksAfter } = await admin
      .from('student_work').select('id', { count: 'exact', head: true }).in('student_id', sids)
    assertEqual(worksAfter || 0, worksBefore || 0, 'no student_work rows inserted/deleted')

    section('recoverCourseExtractions — dryRun writes nothing')
    await admin.from('student_work').update({ content: null }).eq('id', targetId)
    const dry = await recoverCourseExtractions({
      admin, orgUnitId: '2001', dryRun: true, runAutoTag: false,
    })
    assertEqual(dry.recovered, 1, 'dry-run reports 1 would-recover')
    const { data: stillEmpty } = await admin
      .from('student_work').select('content').eq('id', targetId).single()
    assertTrue(
      stillEmpty!.content === null,
      'dry-run did NOT write (content still null)',
      JSON.stringify(stillEmpty)
    )
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
```

Remove the now-unused bottom guards `void installMockValence`, `void uninstallMockValence`, `void clearValenceTokenCache`, `void listCoursesUnderOrgUnit`, `void syncOneCourse`, `void MOCK_STATS`, `void recoverCourseExtractions` (now genuinely used).

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: FAIL — `recoverCourseExtractions` is imported but not yet exported (`recoverCourseExtractions is not a function`).

- [ ] **Step 3: Implement `recoverCourseExtractions`**

Append to `src/lib/recovery/recover-extractions.ts`:

```ts
interface EmptyRow {
  id: string
  externalId: string
}

/**
 * Per-course recovery. READ-only except for one content-only UPDATE per
 * recovered row (skipped entirely when dryRun). Re-list each folder once
 * (rows are grouped by folderId), match the submission by id, download
 * its first file, re-extract with the fixed extractor.
 */
export async function recoverCourseExtractions(params: {
  admin: SupabaseClient
  orgUnitId: string
  dryRun: boolean
  /** Seam (default false). When false the LLM auto-tag branch is skipped
   *  entirely — no cost, no work_skill_tag writes. Body intentionally
   *  unimplemented (spec out-of-scope); enabling later is additive. */
  runAutoTag?: boolean
}): Promise<CourseRecoveryResult> {
  const { admin, orgUnitId, dryRun } = params
  const runAutoTag = params.runAutoTag ?? false

  const result: CourseRecoveryResult = {
    orgUnitId,
    scanned: 0,
    recovered: 0,
    stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
    errors: [],
  }

  // Collect this course's empty rows (paginated, JS-side empty filter).
  const empties: EmptyRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('student_work')
      .select('id, external_id, content')
      .eq('source', 'd2l_valence_sync')
      .like('external_id', `d2l:${orgUnitId}:%`)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`recover select failed (ou=${orgUnitId}): ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (!isEmpty(row.content as string | null)) continue
      empties.push({ id: row.id as string, externalId: row.external_id as string })
    }
    if (data.length < PAGE) break
  }
  result.scanned = empties.length

  // Group rows by folder so each folder is listed exactly once.
  const byFolder = new Map<string, { folderId: string; rows: { id: string; submissionId: string }[] }>()
  for (const row of empties) {
    const coords = parseWorkExternalId(row.externalId)
    if (!coords) {
      result.errors.push(`unparseable external_id: ${row.externalId}`)
      continue
    }
    const g = byFolder.get(coords.folderId) ?? { folderId: coords.folderId, rows: [] }
    g.rows.push({ id: row.id, submissionId: coords.submissionId })
    byFolder.set(coords.folderId, g)
  }

  for (const group of byFolder.values()) {
    let submissions
    try {
      submissions = await listAssignmentSubmissions(orgUnitId, group.folderId)
    } catch (err) {
      result.errors.push(`folder ${group.folderId} list failed: ${String(err)}`)
      continue
    }
    const byId = new Map(submissions.map(s => [s.submissionId, s]))

    for (const row of group.rows) {
      const submission = byId.get(row.submissionId)
      if (!submission) {
        result.stillEmpty.submissionGone++
        continue
      }
      if (submission.files.length === 0) {
        result.stillEmpty.noFile++
        continue
      }
      const file = submission.files[0]
      let extracted = ''
      try {
        const downloaded = await downloadSubmissionFile(
          orgUnitId, group.folderId, submission.submissionId, file.fileId
        )
        if (isSupported(downloaded.filename)) {
          extracted = await extractText(downloaded.buffer, downloaded.filename)
        } else if (downloaded.contentType.startsWith('text/')) {
          extracted = downloaded.buffer.toString('utf-8').substring(0, 8000)
        } else {
          result.stillEmpty.unsupported++
          continue
        }
      } catch (err) {
        result.stillEmpty.downloadError++
        result.errors.push(
          `download/extract failed (sub=${submission.submissionId} file=${file.fileName}): ${String(err)}`
        )
        continue
      }

      if (!extracted || extracted.trim().length === 0) {
        result.stillEmpty.emptyText++
        continue
      }

      result.recovered++
      if (dryRun) continue

      const { error: updErr } = await admin
        .from('student_work')
        .update({ content: extracted })
        .eq('id', row.id)
      if (updErr) {
        result.recovered--
        result.errors.push(`update failed (work=${row.id}): ${updErr.message}`)
        continue
      }

      if (runAutoTag) {
        // SEAM (intentionally unimplemented; default-off, spec out-of-
        // scope). Future: autoTagWork(work) + work_skill_tag insert.
      }
    }
  }

  return result
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: PASS. The behavioral section asserts: 1 row recovered, content repopulated to the original extracted text, no `work_skill_tag` added (seam off), no `student_work` count change, and the dry-run leaves `content` null. `N passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recovery/recover-extractions.ts scripts/test-recover-extractions.ts
git commit -m "$(cat <<'EOF'
recovery: per-course re-extract worker (content-only update, dry-run, seam off)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Recovery core — `aggregateRecoveryResults`

**Files:**
- Modify: `src/lib/recovery/recover-extractions.ts` (append `aggregateRecoveryResults`)
- Modify: `scripts/test-recover-extractions.ts` (add pure aggregation section)

- [ ] **Step 1: Write the failing test section**

In `scripts/test-recover-extractions.ts`, add this section immediately before the final `console.log(\`\n${passed} passed...\`)` line, and add `aggregateRecoveryResults` to the existing import from `@/lib/recovery/recover-extractions`:

```ts
  section('aggregateRecoveryResults (pure)')
  const agg = aggregateRecoveryResults([
    {
      orgUnitId: 'A', scanned: 5, recovered: 3,
      stillEmpty: { unsupported: 1, noFile: 1, submissionGone: 0, emptyText: 0, downloadError: 0 },
      errors: ['x'],
    },
    {
      orgUnitId: 'B', scanned: 2, recovered: 2,
      stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
      errors: [],
    },
  ])
  assertEqual(agg.orgUnitsProcessed, 2, 'orgUnitsProcessed = 2')
  assertEqual(agg.scanned, 7, 'scanned summed (5+2)')
  assertEqual(agg.recovered, 5, 'recovered summed (3+2)')
  assertEqual(agg.stillEmpty.unsupported, 1, 'stillEmpty.unsupported summed')
  assertEqual(agg.errorCount, 1, 'errorCount summed (1+0)')
  assertEqual(agg.perCourse.length, 2, 'perCourse retained')
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: FAIL — `aggregateRecoveryResults is not a function` (not yet exported).

- [ ] **Step 3: Implement `aggregateRecoveryResults`**

Append to `src/lib/recovery/recover-extractions.ts`:

```ts
/** Sum per-course results into one run summary. Pure. */
export function aggregateRecoveryResults(
  results: CourseRecoveryResult[]
): RecoverySummary {
  const stillEmpty = {
    unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0,
  }
  let scanned = 0
  let recovered = 0
  let errorCount = 0
  for (const r of results) {
    scanned += r.scanned
    recovered += r.recovered
    errorCount += r.errors.length
    stillEmpty.unsupported += r.stillEmpty.unsupported
    stillEmpty.noFile += r.stillEmpty.noFile
    stillEmpty.submissionGone += r.stillEmpty.submissionGone
    stillEmpty.emptyText += r.stillEmpty.emptyText
    stillEmpty.downloadError += r.stillEmpty.downloadError
  }
  return {
    orgUnitsProcessed: results.length,
    scanned,
    recovered,
    stillEmpty,
    errorCount,
    perCourse: results,
  }
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: PASS — all sections green, `N passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recovery/recover-extractions.ts scripts/test-recover-extractions.ts
git commit -m "$(cat <<'EOF'
recovery: pure run-summary aggregator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Trigger tasks — child `recover-course` + parent `recover-empty-extractions`

**Files:**
- Create: `src/trigger/recover-course.ts`
- Create: `src/trigger/recover-empty-extractions.ts`

These are thin wrappers over the Task 2–4 core (already tested); they mirror `src/trigger/sync-course.ts` and `src/trigger/sync-le3.ts`. Their correctness is the core's correctness plus the structural zero-write scan in Task 6. There is no in-process Trigger-runtime test in this repo's convention (the existing `sync-*` tasks have none); the gate here is `npm run build` (typecheck) + the Task 6 structural scan + manual dry-run on deploy.

- [ ] **Step 1: Create the child task**

Create `src/trigger/recover-course.ts`:

```ts
/**
 * recover-course — Trigger.dev child task. Recovers empty-content
 * student_work rows for exactly ONE course (org unit). Fanned out by
 * the recover-empty-extractions parent. Bounded queue concurrency keeps
 * us under D2L rate limits; one-course working set keeps memory flat.
 * Mirrors src/trigger/sync-course.ts.
 */
import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import { recoverCourseExtractions } from '@/lib/recovery/recover-extractions'
import { ValenceRateLimitError } from '@/lib/d2l'

const CONCURRENCY = Number(process.env.RECOVER_COURSE_CONCURRENCY ?? '4')
const MAX_DURATION = Number(process.env.RECOVER_COURSE_MAX_DURATION ?? '1200')

export const recoverCourseTask = schemaTask({
  id: 'recover-course',
  schema: z.object({
    orgUnitId: z.string(),
    dryRun: z.boolean(),
    runAutoTag: z.boolean().default(false),
  }),
  queue: { name: 'recover-course', concurrencyLimit: CONCURRENCY },
  machine: { preset: 'large-1x' },
  maxDuration: MAX_DURATION,
  retry: {
    maxAttempts: 3, factor: 2,
    minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, randomize: true,
  },
  catchError: async ({ error }) => {
    // Sustained D2L rate-limiting: back the whole task off ~60s instead
    // of immediately re-triggering (mirrors sync-course).
    if (error instanceof ValenceRateLimitError) {
      return { retryAt: new Date(Date.now() + 60_000) }
    }
    return undefined
  },
  run: async (payload) => {
    metadata.parent.set(`course:${payload.orgUnitId}`, 'running')
    logger.info('recover-course start', { ou: payload.orgUnitId, dryRun: payload.dryRun })

    const admin = createAdminClient()
    const result = await recoverCourseExtractions({
      admin,
      orgUnitId: payload.orgUnitId,
      dryRun: payload.dryRun,
      runAutoTag: payload.runAutoTag,
    })

    metadata.parent.set(
      `course:${payload.orgUnitId}`,
      result.errors.length > 0 ? 'completed_with_errors' : 'completed'
    )
    logger.info('recover-course done', {
      ou: payload.orgUnitId, scanned: result.scanned, recovered: result.recovered,
    })
    return result
  },
})
```

- [ ] **Step 2: Create the parent task**

Create `src/trigger/recover-empty-extractions.ts`:

```ts
/**
 * recover-empty-extractions — Trigger.dev parent task.
 *
 * One-time recovery of the student_work rows the PDF-extraction bug
 * left empty. Enumerates the org units that still have empty
 * d2l_valence_sync rows, fans out one recover-course child per org via
 * batchTriggerAndWait (checkpointed; bounded by the child's queue
 * concurrency), aggregates into one summary, and RETURNS it.
 *
 * Deliberately writes NO sync_run row — this is not a sync; observability
 * is the Trigger dashboard + the returned summary. Mirrors the
 * src/trigger/sync-le3.ts fan-out shape.
 *
 * dryRun defaults TRUE: the safe default re-lists + classifies by real
 * file type and reports counts without writing. Run again with
 * dryRun:false to perform the content updates.
 */
import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  listEmptyWorkOrgUnits,
  aggregateRecoveryResults,
  type CourseRecoveryResult,
} from '@/lib/recovery/recover-extractions'
import { recoverCourseTask } from '@/trigger/recover-course'

export const recoverEmptyExtractionsTask = schemaTask({
  id: 'recover-empty-extractions',
  schema: z.object({
    dryRun: z.boolean().default(true),
    runAutoTag: z.boolean().default(false),
    triggeredBy: z.string().optional(),
  }),
  machine: { preset: 'medium-1x' },
  maxDuration: 3600,
  retry: {
    maxAttempts: 3, factor: 2,
    minTimeoutInMs: 5000, maxTimeoutInMs: 60_000, randomize: true,
  },
  run: async (payload) => {
    const admin = createAdminClient()
    metadata.set('stage', 'enumerating').set('dryRun', payload.dryRun)

    const orgUnits = await listEmptyWorkOrgUnits(admin)
    metadata.set('stage', 'fanning-out').set('totalOrgUnits', orgUnits.length)
    logger.info('recover fan-out', { orgUnits: orgUnits.length, dryRun: payload.dryRun })

    if (orgUnits.length === 0) {
      const empty = aggregateRecoveryResults([])
      metadata.set('stage', 'completed')
      return { dryRun: payload.dryRun, summary: empty }
    }

    const handle = await recoverCourseTask.batchTriggerAndWait(
      orgUnits.map(orgUnitId => ({
        payload: { orgUnitId, dryRun: payload.dryRun, runAutoTag: payload.runAutoTag },
      }))
    )

    const results: CourseRecoveryResult[] = []
    for (const run of handle.runs) {
      if (run.ok) {
        results.push(run.output as CourseRecoveryResult)
      } else {
        results.push({
          orgUnitId: 'unknown',
          scanned: 0, recovered: 0,
          stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
          errors: [`child run failed: ${String(run.error)}`],
        })
      }
    }

    const summary = aggregateRecoveryResults(results)
    metadata.set('stage', 'completed')
      .set('scanned', summary.scanned)
      .set('recovered', summary.recovered)
    logger.info('recover completed', {
      dryRun: payload.dryRun, scanned: summary.scanned, recovered: summary.recovered,
    })
    return { dryRun: payload.dryRun, summary }
  },
})
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`

Expected: build succeeds. Trigger task files compile; no TypeScript errors in `src/trigger/recover-*.ts` or the core.

- [ ] **Step 4: Commit**

```bash
git add src/trigger/recover-course.ts src/trigger/recover-empty-extractions.ts
git commit -m "$(cat <<'EOF'
trigger: recover-empty-extractions parent + recover-course child fan-out

Mirrors the sync-le3/sync-course fan-out; reuses ValenceRateLimitError
back-off and checkpointed batchTriggerAndWait. No sync_run row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Structural zero-write invariant test

**Files:**
- Modify: `scripts/test-recover-extractions.ts` (add source-scan section)

- [ ] **Step 1: Write the failing structural section**

In `scripts/test-recover-extractions.ts`, add this section immediately before the final `console.log(\`\n${passed} passed...\`)` line (after the Task 4 aggregation section):

```ts
  section('structural zero-write invariant (source scan)')
  const coreSrc = readFileSync(
    resolve(__dirname, '..', 'src/lib/recovery/recover-extractions.ts'), 'utf-8'
  )
  assertTrue(!coreSrc.includes('.insert('), 'core has no .insert(')
  assertTrue(!coreSrc.includes('.upsert('), 'core has no .upsert(')
  assertTrue(!coreSrc.includes('.delete('), 'core has no .delete(')
  const updateCount = (coreSrc.match(/\.update\(/g) || []).length
  assertEqual(updateCount, 1, 'core has exactly one .update( (the content fill)')
  assertTrue(
    /\.update\(\s*\{\s*content:/.test(coreSrc),
    'the single update is a content-only fill (whitespace-tolerant)'
  )
  for (const rel of [
    'src/trigger/recover-course.ts',
    'src/trigger/recover-empty-extractions.ts',
  ]) {
    const src = readFileSync(resolve(__dirname, '..', rel), 'utf-8')
    assertTrue(!src.includes('.insert('), `${rel} has no .insert(`)
    assertTrue(!src.includes('.upsert('), `${rel} has no .upsert(`)
    assertTrue(!src.includes('.delete('), `${rel} has no .delete(`)
    assertTrue(!src.includes('.update('), `${rel} has no .update( (delegates to core)`)
    assertTrue(!src.includes('sync_run'), `${rel} does not touch sync_run`)
  }
```

Remove the now-unused bottom guard `void readFileSync`.

- [ ] **Step 2: Run the test — verify it PASSES immediately**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: PASS. This is a guard test, not red-then-green: it must be green against the code written in Tasks 3–5. If `updateCount !== 1` or any forbidden token is present, that is a real zero-write-discipline violation in the implementation — fix the implementation (not the test) until green. `N passed, 0 failed`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-recover-extractions.ts
git commit -m "$(cat <<'EOF'
recovery: structural zero-write invariant test

Asserts the recovery core has exactly one .update (content-only) and no
insert/upsert/delete; the trigger wrappers touch no DB and no sync_run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Admin route + structural gate scan

**Files:**
- Create: `src/app/api/admin/recover-extractions/route.ts`
- Modify: `scripts/test-recover-extractions.ts` (add route gate-scan section)

The route mirrors `src/app/api/admin/sync-le3/route.ts` (proven pattern: `createServerClient` + `getUser` + coach lookup by `auth_user_id`) and adds an `isAdminEmail(coach.email)` defense-in-depth check (the Tools page is already admin-gated; this is belt-and-suspenders, per spec).

**Why a structural scan, not an execution test (honest):** route handlers in this repo cannot be exercised under `tsx` — `next/headers` `cookies()` throws "called outside a request scope" with no Next runtime, so an in-process `POST(req)` would hit the catch-all and return 500, not 401 (false-green). This is exactly why the codebase has **zero** route tests, and why `sync-le3` — the route we mirror — has no automated auth test. The honest, codebase-consistent gate is a source-scan asserting every authorization branch + the zero-write property is present; **live admin/non-admin behavior is verified manually on deploy** (the user already does manual deploy verification — see Deployment notes). This is a guard test (green the moment the route exists), red→green via the file's absence.

- [ ] **Step 1: Write the failing route gate-scan section**

In `scripts/test-recover-extractions.ts`, add this section immediately before the final `console.log` line:

```ts
  section('route: gate composition + zero-write (source scan)')
  const routeSrc = readFileSync(
    resolve(__dirname, '..', 'src/app/api/admin/recover-extractions/route.ts'),
    'utf-8'
  )
  assertTrue(/status:\s*401/.test(routeSrc), 'route returns 401 (no user)')
  assertTrue(routeSrc.includes('auth_user_id'), 'route looks up coach by auth_user_id')
  assertTrue(/status:\s*403/.test(routeSrc), 'route returns 403 (non-coach / non-admin)')
  assertTrue(routeSrc.includes('isAdminEmail'), 'route enforces isAdminEmail defense-in-depth')
  assertTrue(
    routeSrc.includes('TRIGGER_SECRET_KEY') && /status:\s*503/.test(routeSrc),
    'route returns 503 when TRIGGER_SECRET_KEY is absent'
  )
  assertTrue(
    !routeSrc.includes('.insert(') &&
      !routeSrc.includes('.upsert(') &&
      !routeSrc.includes('.update(') &&
      !routeSrc.includes('.delete('),
    'route performs no DB writes (select-only auth + tasks.trigger)'
  )
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: FAIL — `readFileSync` throws `ENOENT` because `src/app/api/admin/recover-extractions/route.ts` does not exist yet.

- [ ] **Step 3: Create the route**

Create `src/app/api/admin/recover-extractions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/v2-auth'
import { tasks } from '@trigger.dev/sdk'
import type { recoverEmptyExtractionsTask } from '@/trigger/recover-empty-extractions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/recover-extractions
 *
 * Enqueues the one-time empty-extraction recovery via Trigger.dev.
 * Trigger.dev is REQUIRED: if TRIGGER_SECRET_KEY is unset, returns 503.
 *
 * Access control (defense-in-depth; the Tools page is already
 * ADMIN_EMAILS-gated): authenticated coach AND isAdminEmail(coach.email).
 *
 * Body (all optional):
 *   { "dryRun": boolean (default true), "runAutoTag": boolean (default false) }
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: coach } = await admin
      .from('coach')
      .select('id, email, name')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!coach) {
      return NextResponse.json(
        { error: 'Recovery can only be triggered by coaches' },
        { status: 403 }
      )
    }

    if (!isAdminEmail(coach.email as string)) {
      return NextResponse.json(
        { error: 'Recovery is limited to designated administrators' },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      dryRun?: boolean
      runAutoTag?: boolean
    }
    const dryRun = body.dryRun !== false // default true
    const runAutoTag = body.runAutoTag === true // default false

    if (!process.env.TRIGGER_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            'Recovery requires Trigger.dev. TRIGGER_SECRET_KEY is not set on this deployment.',
        },
        { status: 503 }
      )
    }

    const handle = await tasks.trigger<typeof recoverEmptyExtractionsTask>(
      'recover-empty-extractions',
      { dryRun, runAutoTag, triggeredBy: coach.email as string }
    )

    return NextResponse.json({
      status: 'enqueued',
      dryRun,
      triggerRunId: handle.id,
      message: `Recovery task enqueued via Trigger.dev (dryRun=${dryRun})`,
    })
  } catch (error) {
    console.error('Recovery trigger error:', error)
    return NextResponse.json(
      { error: 'Recovery trigger failed: ' + String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-recover-extractions.ts`

Expected: PASS — the route now exists and contains every asserted gate branch (401/403/403/503) and no write tokens. Full suite green: `N passed, 0 failed`, exit 0. If any gate-scan assertion is red, fix the **route** (not the test) until the gate composition matches.

- [ ] **Step 5: Typecheck**

Run: `npm run build`

Expected: build succeeds; no TypeScript errors in `src/app/api/admin/recover-extractions/route.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/recover-extractions/route.ts scripts/test-recover-extractions.ts
git commit -m "$(cat <<'EOF'
api/recover-extractions: admin-gated trigger route (+ structural gate scan)

Mirrors api/sync-le3 auth; adds isAdminEmail defense-in-depth and a
503 when TRIGGER_SECRET_KEY is absent. dryRun defaults true. Live auth
behavior is verified manually on deploy (no Next runtime under tsx).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Tools panel + mount

**Files:**
- Create: `src/components/coach/RecoverExtractionsPanel.tsx`
- Modify: `src/app/v2/(coach)/coach/tools/ToolsView.tsx:33-38`

No component-test convention exists in this repo (the existing `@/components/coach/*` panels have none). The gate for this task is `npm run build` (typecheck/lint) plus manual verification on deploy.

- [ ] **Step 1: Create the panel component**

Create `src/components/coach/RecoverExtractionsPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'

/**
 * Admin panel: trigger the one-time empty-extraction recovery.
 * Dry-run is the default and the recommended first action — it reports
 * how many empty rows would be recovered (by ground-truth file type)
 * without writing. Self-contained: button → POST → enqueue readout.
 * The run summary (scanned / recovered / still-empty by reason) lives
 * in the Trigger.dev dashboard, not here — the panel only confirms the
 * enqueue.
 */
interface EnqueueResponse {
  status?: string
  dryRun?: boolean
  triggerRunId?: string
  message?: string
  error?: string
}

export function RecoverExtractionsPanel() {
  const [dryRun, setDryRun] = useState(true)
  const [busy, setBusy] = useState(false)
  const [resp, setResp] = useState<EnqueueResponse | null>(null)

  async function run(): Promise<void> {
    setBusy(true)
    setResp(null)
    try {
      const r = await fetch('/api/admin/recover-extractions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      setResp((await r.json()) as EnqueueResponse)
    } catch (e) {
      setResp({ error: String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">
        Recover empty extractions
      </h2>
      <p className="text-sm text-gray-600 mt-1">
        One-time repair of synced work rows the old PDF extractor left
        empty. Re-fetches each file from D2L and re-extracts in place.
        Dry-run reports what would be recovered without writing.
      </p>

      <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={e => setDryRun(e.target.checked)}
        />
        Dry run (no writes) — recommended first
      </label>

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-3 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Enqueuing…' : dryRun ? 'Run dry-run' : 'Run recovery (writes)'}
      </button>

      {resp && (
        <div className="mt-4 text-sm">
          {resp.error ? (
            <p className="text-red-700">{resp.error}</p>
          ) : (
            <div className="space-y-1 text-gray-700">
              <p className="text-green-800 font-medium">{resp.message}</p>
              {resp.triggerRunId && (
                <p className="text-xs text-gray-500">
                  Trigger run: {resp.triggerRunId} — watch the Trigger.dev
                  dashboard for the summary (scanned / recovered / still-empty
                  by reason).
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Mount it under the Sync tab**

In `src/app/v2/(coach)/coach/tools/ToolsView.tsx`, add the import after line 7
(`import { LiveActivityPanel } from '@/components/coach/LiveActivityPanel'`):

```tsx
import { RecoverExtractionsPanel } from '@/components/coach/RecoverExtractionsPanel'
```

Then replace the Sync-tab block (lines 33-38):

```tsx
      {tab === 'sync' && (
        <div className="space-y-5">
          <SyncStatusPanel recentRuns={recentSyncRuns} lastSuccessful={lastSuccessful} />
          <SyncInspectorPanel />
        </div>
      )}
```

with:

```tsx
      {tab === 'sync' && (
        <div className="space-y-5">
          <SyncStatusPanel recentRuns={recentSyncRuns} lastSuccessful={lastSuccessful} />
          <SyncInspectorPanel />
          <RecoverExtractionsPanel />
        </div>
      )}
```

- [ ] **Step 3: Typecheck / lint**

Run: `npm run build`

Expected: build succeeds; no TypeScript/ESLint errors in `RecoverExtractionsPanel.tsx` or `ToolsView.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/coach/RecoverExtractionsPanel.tsx "src/app/v2/(coach)/coach/tools/ToolsView.tsx"
git commit -m "$(cat <<'EOF'
tools: dry-run-first Recover Empty Extractions admin panel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run both test scripts**

Run:
```bash
npx tsx scripts/test-extract-text.ts && npx tsx scripts/test-recover-extractions.ts
```

Expected: both exit 0, all sections green. `scripts/test-recover-extractions.ts` needs a working `.env.local` (real Supabase service-role; same requirement as the existing `scripts/test-sync-*.ts`) — it cleans up its own `@mock.test` rows.

- [ ] **Step 2: Regression — existing sync tests still pass**

Run:
```bash
npx tsx scripts/test-sync-course.ts
```

Expected: exit 0. The `extract-text.ts` swap must not regress the live sync path (mock-valence serves `.txt`, so this primarily confirms nothing broke structurally; the PDF path is covered by `test-extract-text.ts`).

- [ ] **Step 3: Final typecheck**

Run: `npm run build`

Expected: success.

- [ ] **Step 4: Confirm no stray `pdf-parse` references remain**

Run:
```bash
grep -rn "pdf-parse" src/ scripts/ trigger.config.ts package.json || echo "CLEAN: no pdf-parse references"
```

Expected: `CLEAN: no pdf-parse references`.

---

## Deployment notes (post-merge, performed by the user — not part of plan execution)

Two independent deploy targets (the recurring gotcha):
1. `git push` → Vercel deploys the route + Tools panel + the `extract-text.ts` fix for **all future syncs**.
2. `npx trigger.dev@latest deploy` (from repo root) — **separate** env store — deploys `recover-empty-extractions` + `recover-course`. The fix only reaches the Trigger worker via this step.

Then, once: open Tools → Sync tab → "Recover empty extractions" → **dry-run first** → review the Trigger.dev dashboard summary (this is when the true PDF-bug count is known by ground truth) → re-run with dry-run unchecked to perform the content updates. Re-runnable: a filled row drops out of the empty set, so a second run safely resumes.

---

## Self-Review

**1. Spec coverage:**
- Extractor fix → Task 1. Regression test (the missing guard) → Task 1 Step 1.
- `unpdf` via dynamic import, drop `pdf-parse`, `trigger.config` external + comment → Task 1 Steps 3–5.
- Recovery scope "by actual file type" (parse external_id → re-list folder → real extension → re-extract supported) → Task 3 `recoverCourseExtractions` (`isSupported(downloaded.filename)` / `text/*` fallback, mirroring `processSubmission`).
- Trigger.dev fan-out mirroring sync, reuse `ValenceRateLimitError`/checkpointed batch, no `sync_run` row → Task 5.
- `dryRun` default true → parent schema default + route default + Task 3 dry-run test.
- `runAutoTag` seam default false, no rewrite to enable → Task 3 (param + guarded unimplemented branch) + behavioral test asserts no tags added.
- Zero-write discipline + structural test → Task 6.
- Admin route + Tools panel, `isAdminEmail` gate, 503 without `TRIGGER_SECRET_KEY` → Tasks 7–8.
- Error handling (per-row non-fatal, rate-limit back-off, isolated course failure) → Task 3 per-row try/catch + `stillEmpty` buckets; Task 5 child `catchError` + parent per-run failure capture.
- Testing: regression (item 1) → Task 1; structural zero-write (item 2) → Task 6; behavioral mock-valence + dry-run (items 3–4) → Task 3; auth (item 5) → Task 7 as a **structural gate scan**, since route handlers can't execute under `tsx` (no Next request scope) — live admin/non-admin behavior is manual on deploy, exactly as `sync-le3` (which has no automated auth test either). Panel (Task 8) gate = `npm run build` + manual, matching the codebase's zero component-test convention. All three deviations from naive execution-testing are explicitly justified in-task, not silently skipped.
- **Deviation:** spec's "clears extractionError" → corrected to content-only (no such column on `student_work`); documented at top + handoff.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step has complete code; every command has expected output. The base64 PDF and `unpdf@1.6.2` API were generated and verified, not guessed. The one intentionally-empty body is the `runAutoTag` seam — explicitly specified as unimplemented-by-design (spec out-of-scope), guarded, and asserted-off by the behavioral test; this is a documented decision, not a placeholder.

**3. Type consistency:** `WorkCoords`, `CourseRecoveryResult`, `RecoverySummary` defined in Task 2, reused unchanged in Tasks 3–5. `recoverCourseExtractions(params)` signature identical across core (Task 3), child task (Task 5), behavioral test (Task 3). `parseWorkExternalId` return shape consistent (Tasks 2, 3, tests). Task ids `recover-empty-extractions` / `recover-course` and queue name `recover-course` consistent across Task 5 + route (Task 7). `aggregateRecoveryResults` returns `RecoverySummary` consumed by the parent task (Task 5); the panel (Task 8) deliberately consumes only the route's `EnqueueResponse` (the summary lives in the Trigger dashboard), so no `RecoverySummary` shape coupling crosses the network boundary.
