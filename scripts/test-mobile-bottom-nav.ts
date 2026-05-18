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

// Task 2 appends its section here.
finish()
