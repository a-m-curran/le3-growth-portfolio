/**
 * Unit tests for the deterministic voice-fidelity metric.
 * USAGE: npx tsx scripts/test-voice-fidelity.ts
 */
import { assertEqual, section, finish } from './_sync-test-harness'
import { scoreVoiceFidelity } from '../src/lib/voice-fidelity'

section('pronoun-normalized verbatim grounding')
{
  const corpus = 'I rewrote my feedback to be specific instead of just nice.'
  const generated = 'You rewrote your feedback to be specific instead of just nice.'
  const r = scoreVoiceFidelity(generated, corpus, 'thin')
  assertEqual(r.groundedPhraseCount >= 1, true, 'a >=4-word student span grounds across the I->you shift')
  assertEqual(r.coverage > 0.5, true, 'most of the generated sentence is grounded')
  assertEqual(r.passed, true, 'thin floor (>=1) met, no banned construction')
}

section('generic prose fails the floor')
{
  const corpus = 'this girl Tanya her essay had a really weak thesis but she is so sweet'
  const generated = 'There is a difference between caring and understanding, and you are starting to see it.'
  const r = scoreVoiceFidelity(generated, corpus, 'rich')
  assertEqual(r.groundedPhraseCount, 0, 'no student spans survive into generic prose')
  assertEqual(r.passed, false, 'rich floor (>=3) not met -> fails')
}

section('banned antithesis-flip construction is detected')
{
  const corpus = 'whatever the student actually said here does not matter for this check'
  const generated = 'You are building the kind of empathy that doesn\'t just feel — it listens.'
  const r = scoreVoiceFidelity(generated, corpus, 'thin')
  assertEqual(r.bannedConstructions.length >= 1, true, 'the "doesn\'t just X — it Y" flip is flagged')
  assertEqual(r.passed, false, 'a banned construction forces a fail regardless of grounding')
}

section('floors scale with richness')
{
  const corpus = 'I reached out to the writing center the same afternoon to ask for help'
  const generated = 'You reached out to the writing center the same afternoon when things slipped.'
  assertEqual(scoreVoiceFidelity(generated, corpus, 'thin').passed, true, 'thin floor met by 1 grounded phrase')
  assertEqual(scoreVoiceFidelity(generated, corpus, 'rich').passed, false, 'rich needs >=3 grounded phrases')
}

finish()
