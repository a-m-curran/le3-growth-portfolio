# Voice Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated skill narratives + career talking points demonstrably sound like the student (built from their own words), with a deterministic, testable voice-fidelity metric enforcing it.

**Architecture:** A pure metric lib (`voice-fidelity.ts`) scores verbatim grounding (pronoun-normalized ≥4-word spans) + detects the antithesis-flip AI-ism. The narrative generator gains the student's raw reflection text in context, a reshaped prompt, and a regenerate-once-if-low fidelity gate (degrade, never block). Career talking points are re-grounded in the student's phrasing and scored the same way.

**Tech Stack:** TypeScript, the existing `llm-client` + `llm-prompts` + `conversation-engine-live`. Pure-function unit tests via `npx tsx` against `scripts/_sync-test-harness.ts`.

**Spec:** `docs/superpowers/specs/2026-06-10-voice-fidelity-design.md`

---

## File Structure

- **Create:** `src/lib/voice-fidelity.ts` — pure scoring lib (Task 1)
- **Create:** `scripts/test-voice-fidelity.ts` — unit tests for the lib (Task 1)
- **Modify:** `src/lib/llm-prompts.ts` — `NarrativeContext` + `buildNarrativeContext` (Task 2); narrative prompt reshape (Task 3); career prompt split (Task 5)
- **Modify:** `src/app/api/narrative/generate/route.ts` — populate `responseText` into the context (Task 2)
- **Modify:** `src/lib/conversation-engine-live.ts` — narrative fidelity gate (Task 4); career re-grounding + talking-points gate (Task 5)

---

## Task 1: Voice-fidelity metric lib

**Files:**
- Create: `src/lib/voice-fidelity.ts`
- Create: `scripts/test-voice-fidelity.ts`

- [ ] **Step 1: Write the failing test** — Create `scripts/test-voice-fidelity.ts` with EXACTLY:

```ts
/**
 * Unit tests for the deterministic voice-fidelity metric.
 * USAGE: npx tsx scripts/test-voice-fidelity.ts
 */
import { assertEqual, section, finish } from './_sync-test-harness'
import { scoreVoiceFidelity } from '../src/lib/voice-fidelity'

section('pronoun-normalized verbatim grounding')
{
  // Student wrote first-person; narrative writes second-person. The
  // distinctive phrase must still ground despite the pronoun shift.
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
  // One grounded phrase: passes thin, fails rich.
  const corpus = 'I reached out to the writing center the same afternoon to ask for help'
  const generated = 'You reached out to the writing center the same afternoon when things slipped.'
  assertEqual(scoreVoiceFidelity(generated, corpus, 'thin').passed, true, 'thin floor met by 1 grounded phrase')
  assertEqual(scoreVoiceFidelity(generated, corpus, 'rich').passed, false, 'rich needs >=3 grounded phrases')
}

finish()
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-voice-fidelity.ts
```
Expected: FAIL — `voice-fidelity.ts` doesn't exist.

- [ ] **Step 3: Create the lib** — Create `src/lib/voice-fidelity.ts` with EXACTLY:

```ts
/**
 * Deterministic voice-fidelity metric for generated portfolio prose.
 *
 * Scores how much of the student's actual language survives into
 * generated text (narratives, career talking points), and flags the
 * antithesis-flip AI-ism ("it's not X — it's Y"). Pure: no DB, no LLM —
 * so it is a real, repeatable test, not a vibe check.
 *
 * Grounding is measured on pronoun-normalized >=4-word verbatim spans:
 * the student writes "I rewrote my feedback", the narrative writes "you
 * rewrote your feedback" — without mapping first<->second person, the
 * very phrases we care about would never match.
 */

export type Richness = 'thin' | 'developing' | 'rich'

const FLOOR: Record<Richness, number> = { thin: 1, developing: 2, rich: 3 }

const MIN_SPAN = 4 // minimum words in a grounded span
const MAX_SPAN = 12 // cap span length (perf + meaningful unit)

// First-person -> second-person, so the student's "I/my/me" grounds the
// narrative's "you/your". Applied to BOTH texts (idempotent on 2nd person).
const PRONOUN_MAP: Record<string, string> = {
  i: 'you',
  "i'm": "you're",
  "i've": "you've",
  "i'd": "you'd",
  "i'll": "you'll",
  my: 'your',
  mine: 'yours',
  me: 'you',
  myself: 'yourself',
}

// The antithesis-flip family. Bounded char gaps keep each match within a
// clause so we don't span whole paragraphs.
const BANNED_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'its-not-its', re: /\bit'?s not\b[^.!?]{0,60}?\bit'?s\b/i },
  { name: 'not-just-pivot', re: /\bnot just\b[^.!?]{0,60}?(?:—|--|\bbut\b)/i },
  { name: 'isnt-its', re: /\bisn'?t\b[^.!?]{0,60}?\bit'?s\b/i },
  { name: 'doesnt-just-pivot', re: /\bdoesn'?t just\b[^.!?]{0,60}?(?:—|--|\bit\b)/i },
]

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’′`]/g, "'") // curly/odd apostrophes -> '
    .replace(/[^a-z0-9'\s]/g, ' ') // strip punctuation, keep contractions
    .split(/\s+/)
    .filter(Boolean)
    .map(w => PRONOUN_MAP[w] ?? w)
}

export interface VoiceFidelityResult {
  groundedPhrases: string[]
  groundedPhraseCount: number
  coverage: number // fraction of generated words inside a grounded span (0-1)
  bannedConstructions: string[]
  passed: boolean
}

export function scoreVoiceFidelity(
  generatedText: string,
  studentCorpus: string,
  richness: Richness
): VoiceFidelityResult {
  const genWords = normalize(generatedText)
  const corpusWords = normalize(studentCorpus)

  // All >=MIN_SPAN-word n-grams from the student corpus.
  const corpusNgrams = new Set<string>()
  const maxN = Math.min(MAX_SPAN, corpusWords.length)
  for (let n = MIN_SPAN; n <= maxN; n++) {
    for (let i = 0; i + n <= corpusWords.length; i++) {
      corpusNgrams.add(corpusWords.slice(i, i + n).join(' '))
    }
  }

  // Greedy longest-match walk over the generated text. Take the LONGEST
  // student span at each position, then SKIP PAST it. Advancing past the
  // match (not by one word) makes each contiguous grounded region count
  // once — else a single long verbatim overlap inflates groundedPhraseCount
  // by emitting a distinct sub-span at every offset inside it (which would
  // let one verbatim sentence clear even the rich floor of 3).
  const grounded = new Set<string>()
  const covered = new Array<boolean>(genWords.length).fill(false)
  let i = 0
  while (i < genWords.length) {
    const maxHere = Math.min(MAX_SPAN, genWords.length - i)
    let matched = 0
    for (let n = maxHere; n >= MIN_SPAN; n--) {
      const span = genWords.slice(i, i + n).join(' ')
      if (corpusNgrams.has(span)) {
        grounded.add(span)
        for (let k = i; k < i + n; k++) covered[k] = true
        matched = n
        break
      }
    }
    i += matched > 0 ? matched : 1
  }

  const groundedPhrases = Array.from(grounded)
  const coverage =
    genWords.length > 0 ? covered.filter(Boolean).length / genWords.length : 0

  const bannedConstructions: string[] = []
  for (const { name, re } of BANNED_PATTERNS) {
    if (re.test(generatedText)) bannedConstructions.push(name)
  }

  const passed =
    groundedPhrases.length >= FLOOR[richness] && bannedConstructions.length === 0

  return {
    groundedPhrases,
    groundedPhraseCount: groundedPhrases.length,
    coverage,
    bannedConstructions,
    passed,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-voice-fidelity.ts
```
Expected: all sections pass (X passed, 0 failed). If the "generic prose fails" case shows a stray ground from a coincidental 4-gram, that's acceptable as long as it stays below the rich floor — but the fixtures are chosen so it shouldn't.

- [ ] **Step 5: Gates**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/lib/voice-fidelity.ts scripts/test-voice-fidelity.ts
```
Expected: tsc 0; eslint clean.

- [ ] **Step 6: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/lib/voice-fidelity.ts scripts/test-voice-fidelity.ts && git commit -m "feat(voice): deterministic voice-fidelity metric (pronoun-normalized grounding + AI-ism detector)"
```

---

## Task 2: Feed the student's raw words into narrative context

**Files:**
- Modify: `src/lib/llm-prompts.ts` (`NarrativeContext` interface + `buildNarrativeContext`)
- Modify: `src/app/api/narrative/generate/route.ts` (populate `responseText`)

- [ ] **Step 1: Extend `NarrativeContext.conversations[]`** — In `src/lib/llm-prompts.ts`, in the `NarrativeContext` interface, add a `responseText` field to the conversations array member, immediately after `synthesisText: string`:

```ts
    synthesisText: string
    /**
     * The student's OWN words for this conversation — their raw phase
     * responses, lightly capped. The generator mirrors these directly;
     * without them it can only paraphrase the synthesis (which reads
     * generic). Assembled by the route from response_phase_1/2/3.
     */
    responseText: string
    suggestedInsight: string
```

- [ ] **Step 2: Render `responseText` in `buildNarrativeContext`** — In the same file, inside `buildNarrativeContext`'s `ctx.conversations.forEach((c, i) => { ... })` loop, add a STUDENT'S WORDS block immediately after the `Synthesis:` line (`parts.push(\`     Synthesis: ${c.synthesisText}\`)`):

```ts
    parts.push(`     Synthesis: ${c.synthesisText}`)
    if (c.responseText) {
      parts.push(`     STUDENT'S OWN WORDS: ${c.responseText}`)
    }
    parts.push(`     Insight: ${c.suggestedInsight}`)
```

- [ ] **Step 3: Populate `responseText` in the route** — In `src/app/api/narrative/generate/route.ts`, find the `.map(...)` that builds the `conversations` array (it currently sets `conversationId`, `synthesisText`, etc. from each `growth_conversation` row `c`). Add a `responseText` field assembled from the raw phase responses, capped to keep the context budget bounded:

```ts
        responseText: [c.response_phase_1, c.response_phase_2, c.response_phase_3]
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map(p => (p.length > 800 ? p.slice(0, 800) + '…' : p))
          .join(' '),
```
(Place it alongside the existing `synthesisText` assignment in the same object literal. The route already `select('*')` from `growth_conversation`, so `response_phase_1/2/3` are present on `c`.)

- [ ] **Step 4: Verify it compiles + the prompt includes the words**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/lib/llm-prompts.ts "src/app/api/narrative/generate/route.ts"
```
Expected: tsc 0 (every `NarrativeContext` constructor must now provide `responseText` — the route is the only caller; if tsc flags another caller, add `responseText` there too, defaulting to `''`). eslint clean.

- [ ] **Step 5: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/lib/llm-prompts.ts "src/app/api/narrative/generate/route.ts" && git commit -m "feat(voice): feed the student's raw reflection words into narrative context"
```

---

## Task 3: Reshape the narrative prompt — find, don't write + ban the AI-ism

**Files:**
- Modify: `src/lib/llm-prompts.ts` (`NARRATIVE_GENERATION_SYSTEM_PROMPT`)

- [ ] **Step 1: Audit + fix the prompt's own AI-ism** — In `NARRATIVE_GENERATION_SYSTEM_PROMPT`, the VOICE AND STYLE bullet currently models the very construction we're banning is elsewhere; first, locate any antithesis-flip in the prompt's own prose (there is one at `llm-prompts.ts:853` in the career prompt — handled in Task 5; the narrative prompt's bullets are clean but verify). No change if none in this prompt.

- [ ] **Step 2: Strengthen the grounding instruction** — In `NARRATIVE_GENERATION_SYSTEM_PROMPT`, replace this VOICE AND STYLE bullet:

```
- Reference specific moments from conversations by quoting the student's words
  (use short quotes from key_moments where provided).
```
with:

```
- BUILD THE NARRATIVE FROM THE STUDENT'S OWN WORDS. Each conversation
  includes a "STUDENT'S OWN WORDS" block — their actual reflection text.
  Anchor every paragraph in a specific moment they actually described,
  reusing their distinctive phrases verbatim wherever natural (a downstream
  metric checks that the narrative carries the student's own >=4-word
  phrases). Open on a concrete moment in their words, not an abstraction.
  Never invent a scenario they didn't describe.
```

- [ ] **Step 3: Add a BANNED CONSTRUCTIONS block** — In the same prompt, immediately before the final closing backtick (after the existing RULES section), append:

```
BANNED CONSTRUCTIONS (these are the tell of AI writing — never use them):
- The antithesis flip: "it's not X — it's Y", "not just X, but Y",
  "isn't about X, it's about Y", "doesn't just X — it Y".
  WRONG: "You're building the kind of empathy that doesn't just feel — it listens."
  RIGHT: "You're learning to give feedback that's honest and still kind."
  RIGHT: "You used to just say 'great job.' Now you tell people what would actually make it stronger."
- Before returning, scan your narrativeText for any "not X — Y" / "not just"
  pivot shape and rewrite it as a plain statement in the student's voice.
```

- [ ] **Step 4: Verify it compiles**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/lib/llm-prompts.ts
```
Expected: tsc 0; eslint clean.

- [ ] **Step 5: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/lib/llm-prompts.ts && git commit -m "feat(voice): quote-anchored narrative prompt + banned-construction block"
```

---

## Task 4: Narrative generation fidelity gate (regenerate-once, store score)

**Files:**
- Modify: `src/lib/conversation-engine-live.ts` (`generateSkillNarrative`)

- [ ] **Step 1: Add the gate** — In `src/lib/conversation-engine-live.ts`, add an import at the top alongside the other `@/lib` / relative imports:

```ts
import { scoreVoiceFidelity } from './voice-fidelity'
```

Then, in `generateSkillNarrative`, replace the single-shot generation + parse with a scored, regenerate-once flow. Replace this block:

```ts
  const text = await llm().generate(
    NARRATIVE_GENERATION_SYSTEM_PROMPT,
    buildNarrativeContext(ctx),
    { temperature: 0.5, maxTokens: 2000 }
  )
  const parsed = parseJsonFromLLM<{
    narrativeText: string
    richness: 'thin' | 'developing' | 'rich'
    citations?: Array<{ sentence: string; conversationId: string }>
  }>(text, { narrativeText: text, richness: 'thin', citations: [] })
```
with:

```ts
  // The student's own words, assembled for the fidelity check.
  const studentCorpus = [
    ...ctx.conversations.map(c => c.responseText).filter(Boolean),
    ...ctx.definitions.map(d => d.text),
  ].join(' ')

  type NarrativeJson = {
    narrativeText: string
    richness: 'thin' | 'developing' | 'rich'
    citations?: Array<{ sentence: string; conversationId: string }>
  }
  const userPrompt = buildNarrativeContext(ctx)

  const genOnce = async (extra: string): Promise<NarrativeJson> => {
    const raw = await llm().generate(
      NARRATIVE_GENERATION_SYSTEM_PROMPT,
      userPrompt + extra,
      { temperature: 0.5, maxTokens: 2000 }
    )
    return parseJsonFromLLM<NarrativeJson>(raw, { narrativeText: raw, richness: 'thin', citations: [] })
  }

  let parsed = await genOnce('')
  let fidelity = scoreVoiceFidelity(parsed.narrativeText, studentCorpus, parsed.richness)
  if (!fidelity.passed) {
    // Degrade, never block: try once more with a stronger nudge, keep the
    // higher-grounded attempt. A weaker narrative still ships.
    const retry = await genOnce(
      '\n\nREVISION: Use MORE of the student\'s own words verbatim — anchor each ' +
        'paragraph in a specific moment they described. Remove any "not X — it\'s Y" ' +
        'construction. Return the same JSON shape.'
    )
    const retryFidelity = scoreVoiceFidelity(retry.narrativeText, studentCorpus, retry.richness)
    if (retryFidelity.groundedPhraseCount >= fidelity.groundedPhraseCount) {
      parsed = retry
      fidelity = retryFidelity
    }
  }
```

- [ ] **Step 2: Return the fidelity score** — Update `generateSkillNarrative`'s return type and `return` to surface the score so the route can persist it. Change the return-type's closing to add a `voiceFidelity` field, and the final `return`:

Add to the `Promise<{ ... }>` return type (after `citations: ...`):
```ts
  voiceFidelity: { groundedPhraseCount: number; coverage: number; passed: boolean }
```
And change the final return to:
```ts
  return {
    narrativeText: parsed.narrativeText,
    richness: parsed.richness,
    citations: validCitations,
    voiceFidelity: {
      groundedPhraseCount: fidelity.groundedPhraseCount,
      coverage: fidelity.coverage,
      passed: fidelity.passed,
    },
  }
```
(The existing citation-validation block stays as-is between the generation and the return.)

- [ ] **Step 3: Persist the score in the route** — In `src/app/api/narrative/generate/route.ts`, where the generated narrative is written to `skill_narrative`, fold the fidelity score into the existing `data_sources_used` jsonb (no migration — the column exists). Read the file to find the insert/upsert; add to the `data_sources_used` object:
```ts
        voiceFidelity: result.voiceFidelity,
```
(where `result` is the value returned from `generateSkillNarrative`. If `data_sources_used` is currently set to a different shape, merge — don't drop existing keys.)

- [ ] **Step 4: Verify**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/lib/conversation-engine-live.ts "src/app/api/narrative/generate/route.ts"
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-voice-fidelity.ts
```
Expected: tsc 0; eslint clean; metric tests still green.

- [ ] **Step 5: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/lib/conversation-engine-live.ts "src/app/api/narrative/generate/route.ts" && git commit -m "feat(voice): narrative fidelity gate (regenerate-once, store score)"
```

---

## Task 5: Career re-grounding — student-voice talking points

**Files:**
- Modify: `src/lib/conversation-engine-live.ts` (`generateCareerOutput`)
- Modify: `src/lib/llm-prompts.ts` (`CAREER_OUTPUT_SYSTEM_PROMPT`, `buildCareerOutputContext`)

- [ ] **Step 1: Pass the student's grounding material into career** — In `src/lib/conversation-engine-live.ts`, extend the `narratives` param of `generateCareerOutput` with the student's verbatim phrases per skill, after `citations?`:

```ts
    /** The student's own grounded phrases for this skill (from the
     *  narrative's voice-fidelity scoring), as raw material for
     *  re-grounding the talking points in their phrasing. */
    studentPhrases?: string[]
```
The caller (wherever `generateCareerOutput` is invoked — find it via grep `generateCareerOutput(`) must pass `studentPhrases` from the per-skill narrative's `voiceFidelity.groundedPhrases` (thread `groundedPhrases` through `generateSkillNarrative`'s return as well, or re-derive). If the caller doesn't have them, pass `[]` — the prompt degrades to its current behavior.

- [ ] **Step 2: Render the phrases in `buildCareerOutputContext`** — In `src/lib/llm-prompts.ts`, in `buildCareerOutputContext`, where each narrative is rendered, add the student's phrases when present:

```ts
    if (n.studentPhrases && n.studentPhrases.length > 0) {
      parts.push(`  The student's own words: ${n.studentPhrases.map(p => `"${p}"`).join('; ')}`)
    }
```
(Place inside the per-narrative loop; match the existing local variable name for the narrative item.)

- [ ] **Step 3: Split the career prompt voice + ban the AI-ism** — In `CAREER_OUTPUT_SYSTEM_PROMPT`:

(a) Fix its own AI-ism at `llm-prompts.ts:853` — replace:
```
- The resume summary should feel cohesive, not just a list of skills.
```
with:
```
- The resume summary should read as a cohesive professional story.
```

(b) Change the `talkingPoints` field instruction (in the OUTPUT FORMAT / rules) so talking points are first-person and in the student's voice. Find the talking-points line and set its guidance to:
```
      // Interview talking points in the STUDENT'S OWN VOICE — first person,
      // how they'd actually say it out loud in an interview, reusing their
      // real phrases. NOT resume-speak. e.g. "When I gave Tanya feedback, I
      // realized 'great job' wasn't actually helping her."
```
Keep `resumeSummary` and `resumeLanguage` third-person professional (unchanged).

(c) Append the same BANNED CONSTRUCTIONS block used in Task 3 (the antithesis-flip list + self-check) before the prompt's closing backtick.

- [ ] **Step 4: Gate the talking points** — In `generateCareerOutput`, after the existing parse + annotation validation, score the talking points and regenerate-once if low. Add the import (if not already present from Task 4 it is in the same file) and, after `const skillDescriptions = parsed.skillDescriptions.map(...)`, compute a corpus from `studentPhrases` across narratives and score the joined talking points:

```ts
  const careerCorpus = narratives.flatMap(n => n.studentPhrases ?? []).join(' ')
  const allTalkingPoints = skillDescriptions.flatMap(sd => sd.talkingPoints).join(' ')
  // 'rich' floor is intentional — career synthesizes across the whole
  // portfolio, so it should carry several of the student's phrases.
  const careerFidelity = scoreVoiceFidelity(allTalkingPoints, careerCorpus, 'rich')
```
If `!careerFidelity.passed` and `careerCorpus` is non-empty, regenerate once with an appended nudge (mirror Task 4's `genOnce` pattern adapted to this function), keep the higher-grounded attempt, and surface `careerFidelity` on the return object (add `voiceFidelity` to the return type + value, like Task 4). If `careerCorpus` is empty (no phrases threaded), skip scoring — don't fail the job.

- [ ] **Step 5: Verify**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/lib/conversation-engine-live.ts src/lib/llm-prompts.ts
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-voice-fidelity.ts
```
Expected: tsc 0; eslint clean; metric tests green.

- [ ] **Step 6: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/lib/conversation-engine-live.ts src/lib/llm-prompts.ts && git commit -m "feat(voice): re-ground career talking points in the student's voice + fidelity gate"
```

---

## Task 6: Whole-feature verification + golden case

**Files:**
- Modify: `scripts/test-voice-fidelity.ts` (append the golden case)

- [ ] **Step 1: Add the Aja golden case** — In `scripts/test-voice-fidelity.ts`, insert before `finish()`:

```ts
section('golden case — the real Aja/Empathy regression')
{
  // Her actual words (excerpt) vs. the CURRENT generic output. The
  // current output must fail; this locks the bar so a regression to
  // generic prose is caught.
  const ajaWords =
    "this girl Tanya her essay had a really weak thesis but she's so sweet and she clearly worked hard on it I kept writing things like great job and interesting point and then I stopped and was like this isn't helpful but telling her the truth felt mean I rewrote my feedback I tried to be specific instead of just nice and I thought about what I would want someone to tell me"
  const currentGeneric =
    "You've always cared about people. But there's a difference between caring and understanding. You're building the kind of empathy that doesn't just feel — it listens."
  const r = scoreVoiceFidelity(currentGeneric, ajaWords, 'rich')
  assertEqual(r.passed, false, 'the current generic narrative fails the bar')
  assertEqual(r.bannedConstructions.length >= 1, true, 'and its ending flags as an AI-ism')
}
```

- [ ] **Step 2: Full gates + regressions + build**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-voice-fidelity.ts
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/lib/voice-fidelity.ts src/lib/conversation-engine-live.ts src/lib/llm-prompts.ts "src/app/api/narrative/generate/route.ts" scripts/test-voice-fidelity.ts
cd /Users/andrewcurran/le3-growth-portfolio && npm run build
```
Expected: voice-fidelity tests green (incl. golden case); tsc 0; eslint clean; build EXIT 0.

- [ ] **Step 3: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add scripts/test-voice-fidelity.ts && git commit -m "test(voice): Aja/Empathy golden regression case"
```

---

## Owner runbook (post-merge)
The metric + new generation apply to **future** generations only. To re-ground existing narratives/career, re-run generation for the affected students (owner step; the route regenerates on demand). No migration, no backfill required for the code to be correct going forward.

## Self-Review

**Spec coverage:** Metric (W1) → Task 1. Raw words into context (W2) → Task 2. Prompt reshape + ban AI-ism (W2) → Task 3. Fidelity gate / regenerate-once / store score (W2) → Task 4. Career split + raw material + talking-points gate (W3) → Task 5. Testing + golden case → Tasks 1 & 6. Degrade-never-block honored in Tasks 4 & 5.

**Placeholder scan:** Task 1 + the metric are fully literal. Tasks 2–5 give exact edits; the few "find the caller / the insert" instructions are precise locators (the implementer reads the named file), not vague TODOs — required because the route's exact insert line shifts. The prompt prose blocks are verbatim.

**Type consistency:** `scoreVoiceFidelity(generatedText, studentCorpus, richness): VoiceFidelityResult` used identically in Tasks 1, 4, 5, 6. `Richness` = `'thin'|'developing'|'rich'` matches the narrative's existing richness type. `responseText: string` added in Task 2, consumed in Task 4's corpus. `studentPhrases?: string[]` defined in Task 5 Step 1, rendered in Step 2, used in Step 4. `voiceFidelity` return field added in Tasks 4 & 5.
