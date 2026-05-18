/**
 * Structural invariants for SP3 (mobile bottom-nav reachability).
 * Components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-mobile-bottom-nav.ts
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

section('SP3: MoreIcon added to icons.tsx')
{
  const icons = read('src/components/v2/icons.tsx')
  assertEqual(/export function MoreIcon\(\{ className \}: IconProps\)/.test(icons), true, 'MoreIcon exported with the IconProps signature')
  assertEqual(/baseProps\(className\)/.test(stripComments(icons).split('MoreIcon')[1] || ''), true, 'MoreIcon uses baseProps like its siblings')
}

section('SP3: BottomTabBar >5 → 4 + More overflow sheet; ≤5 unchanged')
{
  const code = stripComments(read('src/components/v2/BottomTabBar.tsx'))
  assertEqual(/\.slice\(0,\s*5\)/.test(code), false, 'no .slice(0,5) hard truncation')
  assertEqual(/filter\(i => !i\.admin \|\| showAdmin\)/.test(code), true, 'admin filter preserved')
  assertEqual(/length <= 5/.test(code) || /length > 5/.test(code), true, 'has the ≤5 / >5 branch')
  assertEqual(/slice\(0,\s*4\)/.test(code) && /slice\(4\)/.test(code), true, 'primary = first 4, overflow = rest')
  assertEqual(/MoreIcon/.test(code) && /from '\.\/icons'/.test(code), true, 'imports + uses MoreIcon')
  assertEqual(/useState/.test(code), true, 'sheet open/close state')
  assertEqual(/activeNavKey/.test(code), true, 'active-state via activeNavKey preserved')
}
finish()
