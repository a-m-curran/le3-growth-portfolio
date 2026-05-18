/**
 * Structural invariants for SP2 (/v2/me preferences + dual-role).
 * Components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-v2-me-preferences.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { assertEqual, section, finish } from './_sync-test-harness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel: string): string =>
  existsSync(resolve(__dirname, '..', rel))
    ? readFileSync(resolve(__dirname, '..', rel), 'utf-8')
    : ''
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

section('SP2: DataHandlingNotice extracted (single source of truth)')
{
  const dhn = stripComments(read('src/components/student/DataHandlingNotice.tsx'))
  assertEqual(/export function DataHandlingNotice/.test(dhn), true, 'DataHandlingNotice exported')
  assertEqual(/What we bring in from Brightspace/.test(dhn), true, 'notice body present (Brightspace section)')
  assertEqual(/What we don.t do/.test(dhn), true, 'notice body present (what we don\'t do)')
  assertEqual(/AI in the conversations/.test(dhn), true, 'notice body present (AI section)')
}

section('SP2: DataConsentModal reuses DataHandlingNotice + re-homed to v2')
{
  const dcm = stripComments(read('src/components/student/DataConsentModal.tsx'))
  assertEqual(/import \{ DataHandlingNotice \} from '\.\/DataHandlingNotice'/.test(dcm), true, 'DataConsentModal imports DataHandlingNotice')
  assertEqual(/<DataHandlingNotice\s*\/>/.test(dcm), true, 'DataConsentModal renders the shared notice')
  assertEqual(/if \(!status \|\| status\.acknowledged\) return null/.test(dcm), true, 'first-visit gate unchanged')
  assertEqual(/acknowledge-consent/.test(dcm) && /method: 'POST'/.test(dcm), true, 'acknowledge POST preserved')
  const layout = stripComments(read('src/app/v2/(student)/layout.tsx'))
  assertEqual(/import \{ DataConsentModal \} from '@\/components\/student\/DataConsentModal'/.test(layout), true, 'student layout imports DataConsentModal')
  assertEqual(/<DataConsentModal\s*\/>/.test(layout), true, 'student layout mounts DataConsentModal (re-homed from v1 /garden)')
}

// Task 3 appends its section here.
finish()
