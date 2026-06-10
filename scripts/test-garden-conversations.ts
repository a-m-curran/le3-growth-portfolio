/**
 * Regression guard for getGardenData's skill→conversation filter.
 *
 * snakeToCamel() in queries.ts is SHALLOW: it camelCases only top-level
 * keys, so the embedded `conversation_skill_tag(*)` relation becomes
 * `conversationSkillTag` and its array items keep snake_case `skill_id`.
 * A prior bug read `c.skillTags` / `t.skillId` (both undefined), so
 * completed conversations never appeared under any skill in the Growth
 * SkillPanel and conversationCount was always 0. These assertions lock
 * the correct keys in.
 *
 * USAGE: npx tsx scripts/test-garden-conversations.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { assertEqual, section, finish } from './_sync-test-harness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel: string): string =>
  existsSync(resolve(__dirname, '..', rel)) ? readFileSync(resolve(__dirname, '..', rel), 'utf-8') : ''
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

section('getGardenData skill→conversation filter uses the post-snakeToCamel keys')
{
  const q = stripComments(read('src/lib/queries.ts'))
  // The skillConvos filter must read the camelCased relation key + the
  // shallow (snake) tag key.
  assertEqual(/conversationSkillTag\?:\s*\{\s*skill_id:\s*string\s*\}\[\][\s\S]{0,80}\.conversationSkillTag\?\.some/.test(q), true, 'filter reads c.conversationSkillTag (camelCased relation key)')
  assertEqual(/t\.skill_id === skill\.id/.test(q), true, 'filter matches on t.skill_id (shallow snake key)')
  // The broken keys must NOT reappear in the skillConvos filter.
  assertEqual(/\.skillTags\?\.some/.test(q), false, 'no c.skillTags?.some (the broken relation key)')
}

finish()
