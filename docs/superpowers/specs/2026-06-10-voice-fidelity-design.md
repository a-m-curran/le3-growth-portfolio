# Voice Fidelity — Make Generated Prose Sound Like the Student

**Date:** 2026-06-10
**Status:** Design approved, pending spec review
**Roadmap item:** #1 "Mirror the student's words (find, don't write)" — see `docs/superpowers/2026-06-10-llm-quality-roadmap.md`

## Goal

Make the portfolio's generated prose (skill narratives + career talking points) demonstrably sound like the student — built from their own words — and make "sounds like them" a deterministic, testable property rather than a prompt aspiration.

## Background — what exists and why it's generic

The generation chain is: reflection conversations → `conversation_output` extraction (quotes + a "linguistic fingerprint") → **skill narrative** (`NARRATIVE_GENERATION_SYSTEM_PROMPT`) → **career output** (`CAREER_OUTPUT_SYSTEM_PROMPT`, generated *from* the narratives).

The narrative prompt already says "mirror the student's language, use verbatim quotes, never fabricate" and emits substring-matched citations to source conversations. But **`buildNarrativeContext` never passes the student's raw reflection responses** — only the synthesis (already abstracted), the suggested insight, voice-marker *descriptors* ("sentence length: short"), and a few extracted "key moments." The generator writes from second-hand abstractions, so it can't mirror words it never sees.

Evidence (real output, student "Aja", skill "Empathy"):
- Her words: *"this girl Tanya — her essay had a really weak thesis but she's so sweet… I kept writing 'great job!' and 'interesting point!' and then I stopped… telling her the truth felt mean. I rewrote my feedback… I thought about what I would want someone to tell me."*
- Generated: *"You've always cared about people. But there's a difference between caring and understanding… you've moved from just being 'nice'… You're building the kind of empathy that doesn't just feel — it listens."*
- The vivid, quotable specifics are gone; it invents a scenario she didn't describe ("when someone pushes back"); and it ends on the exact antithesis-flip AI-ism ("doesn't just feel — it listens"). Near-zero verbatim overlap.

## Architecture

One spec, three workstreams, sequenced **metric-first** (the deterministic backbone everything else is measured against):

1. **Voice-fidelity metric** (pure, testable lib) — scores how much of the student's actual language survives into generated prose.
2. **Quote-anchored narrative generation** — feed raw words into context; reshape the prompt to build around the student's specific moments in their own words; ban the antithesis-flip construction; enforce fidelity at generation time (degrade, never block).
3. **Career re-grounding** — split voice: professional resume summary/language; student-voice first-person interview talking points, measured for fidelity.

### Workstream 1 — Voice-fidelity metric

New pure module `src/lib/voice-fidelity.ts` (no DB, no LLM — fully deterministic and unit-testable).

- **Inputs:** `generatedText: string`, `studentCorpus: string` (the student's actual reflection responses — `response_phase_1/2/3` across the relevant conversations — plus their skill definitions).
- **Normalization** (applied to both texts before matching): lowercase; collapse whitespace; strip punctuation; **map first-person ↔ second-person pronouns to a common form** (`i→you`, `my→your`, `me→you`, `mine→yours`, `myself→yourself`). This is essential: the student writes "I rewrote my feedback," the narrative writes "you rewrote your feedback" — without pronoun normalization, verbatim matching misses the very phrases we care about.
- **Grounding unit:** distinct contiguous spans of **≥ 4 words** from the normalized student corpus that appear verbatim in the normalized generated text.
- **Outputs:**
  - `groundedPhrases: string[]` — the distinct student spans found in the output (for display/debug).
  - `groundedPhraseCount: number`.
  - `coverage: number` — fraction of the generated text's words that fall inside a grounded span (0–1).
  - `bannedConstructions: string[]` — matches of the antithesis-flip family (regexes for `it's not … it's …`, `not just … (—|but) …`, `isn't … it's …`, `doesn't just … it …`). Catches the AI-ism deterministically.
- **Pass criterion:** `meetsFloor(richness)` where the floor is `{ thin: 1, developing: 2, rich: 3 }` grounded phrases (tunable constants), AND `bannedConstructions.length === 0`.
- Exposed as `scoreVoiceFidelity(generatedText, studentCorpus, richness)` returning the full result + a `passed: boolean`.

**Known v1 limitation (documented, not fixed):** a ≥4-word verbatim span can be low-value ("and then I was"). v1 accepts this noise; the floor + the raw-words fix carry the win. A distinctiveness weighting (downweight stopword-heavy spans) is a noted future refinement.

### Workstream 2 — Quote-anchored narrative generation

- **Context:** extend `NarrativeContext.conversations[]` with the student's raw response text per conversation (`responseText`, assembled from `response_phase_1/2/3`, capped per conversation for token budget — e.g. ~800 chars/phase, mirroring the existing 300-char work-description cap pattern). `buildNarrativeContext` renders it under each conversation as the student's actual words.
- **Prompt reshape** (`NARRATIVE_GENERATION_SYSTEM_PROMPT`): make verbatim grounding the backbone, not optional flavor — open on a concrete moment in the student's own words; preserve their distinctive phrases; keep short verbatim quotes. Add a **BANNED CONSTRUCTIONS** block naming the antithesis flip with WRONG + two RIGHT rewrites and a self-check instruction ("before returning, scan for 'not X — it's Y' shapes and rewrite them"). Audit the existing prompt's own examples for the AI-ism first (the prompt currently contains one at `llm-prompts.ts:853`).
- **Generation-time enforcement** (`generateSkillNarrative` in `conversation-engine-live.ts`): after generation, run `scoreVoiceFidelity` on `narrativeText` vs the student corpus. If `!passed`, regenerate **once** with an appended "use more of the student's own words; remove the flagged construction" nudge. Keep the higher-`groundedPhraseCount` attempt. **Never throw / never block** — a low-scoring narrative still ships. Persist the score (`skill_narrative` already has `data_sources_used jsonb` — store `{ voiceFidelity: { groundedPhraseCount, coverage, passed } }` there; no migration needed).

### Workstream 3 — Career re-grounding

- **Feed raw material into career context too.** Career is generated *from* narratives, so it has the same root cause one level down — it can't ground talking points in the student's phrasing if it never sees it. `buildCareerOutputContext` must also receive the student's verbatim material per skill (the grounded quotes/phrases surfaced from the narrative generation, plus the student's actual short quotes), as the raw material talking points are built from.
- **Split voice** in `CAREER_OUTPUT_SYSTEM_PROMPT`: keep `resumeSummary` + per-skill `resumeLanguage` third-person professional (unchanged intent). Re-ground the **`talkingPoints`** in the student's own phrasing / first person — they should sound like the student actually talking in an interview, not a resume bot.
- Add the same BANNED CONSTRUCTIONS block.
- Run `scoreVoiceFidelity` on the **talking points only** (joined) vs the student corpus; same regenerate-once-then-keep-better. Persist the talking-points score alongside the career output record (in its existing storage; confirm the exact column during implementation). Resume language is intentionally not voice-scored (professional third-person is the correct target there).

## Testing

- `scripts/test-voice-fidelity.ts` (or a runnable unit harness): unit-test `scoreVoiceFidelity` against fixtures — pronoun-normalized matching ("I rewrote my feedback" grounds "you rewrote your feedback"); the floor logic per richness; the banned-construction detector (the Aja narrative's ending must flag). This is the deterministic regression backbone.
- A golden-case assertion using the real Aja Empathy example: the *current* output fails (0 grounded phrases + 1 banned construction); a fixture of the *desired* shape passes. Locks the bar in.
- Persona-walkthrough samples (roadmap #2) feed real cases over time.
- Standard gates: `tsc --noEmit` 0, eslint clean, `npm run build` 0, existing regression suites green.

## Out of scope / deferred

- Distinctiveness-weighted scoring (downweight stopword-heavy spans) — noted v1 refinement.
- LLM-judge "does this sound like the same person" — explicitly avoided; the point is a deterministic metric.
- Surfacing voice-fidelity scores to coaches/admin — observability only for now (stored, not surfaced).
- The other roadmap items (#2–#7) — separate cycles.
- Re-generating all existing narratives — the metric + new generation apply going forward; a backfill re-gen is a separate owner-run step if desired.

## Reversibility

The metric is additive (new pure lib). The prompt/context changes affect only *future* generations; reverting restores prior behavior. Scores stored in the existing `data_sources_used` jsonb (no schema change). No data migration.
