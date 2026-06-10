# LLM Quality & Reliability Roadmap

Captured 2026-06-10 from cross-project learnings (another LLM product) and mapped onto the LE3 Growth Portfolio. Ordered by leverage for *this* product. Each item is its own brainstorm → spec → plan → ship cycle; this is the backlog, not a design.

Status legend: **gap** (not started) · **partial** (some of this already exists / done ad hoc) · **done**.

---

## 1. Mirror the student's words ("find, don't write") — START HERE
**Principle:** Personalization = extraction over generation. Generated prose should mirror the student's verbatim language (their phrases, their metaphors), not paraphrase into polish. "Sounds like me" beats eloquent, and verbatim is testable where eloquent isn't.
**Where it lands:** narrative generation (`/api/narrative/generate`, `llm-prompts.ts`), career language (`/api/career`), conversation synthesis. Also compounds the just-restored student skill definitions (surface their words, don't smooth them).
**Why for us:** It *is* the product thesis — we articulated it this session as "sounds like you." Highest leverage + has a testable definition (does generated text contain the student's actual reflection phrases?).
**Effort:** Design-heavy (needs brainstorm) + prompt changes + a verbatim-overlap test.
**Status:** gap. **Next action: brainstorm (in progress).**

## 2. Persona walkthroughs as QA → code-enforced guards
**Principle:** Full in-character end-to-end runs catch bug classes no unit test will. Every finding becomes a code guard + regression test, so walkthroughs ratchet quality instead of sampling it.
**Where it lands:** demo personas (Aja, Marcus, Sofia, Elizabeth) across the full loop: submit → reflect → complete → narrative → career → growth panel → coach view.
**Why for us:** We literally got burned this session — the Yanita bug (completed conversation invisible under skills) surfaced only on a real completion, no structural test caught it. We already ratcheted that one into a regression guard; institutionalize the practice.
**Effort:** Medium — a walkthrough checklist + first systematic run; each finding → guard + test.
**Status:** partial (did it reactively once).

## 3. Prompts steer, code guarantees
**Principle:** Every quality/privacy rule we care about gets a deterministic enforcement layer. Degrade rather than block (strip the bad part, never fail the user's job).
**Where it lands:** two concrete guards —
  - **Student-facing-text sanitizer:** strip assessment jargon (`developing`/`thin`/SDT level names) from *any* generated prose, so a future prompt can't reintroduce what we hid in the UI this session.
  - **Narrative source-provenance verification:** every inline source link must resolve to a real conversation; strip unverifiable ones rather than render a dead/fabricated cite.
**Why for us:** We did two ad-hoc versions this session (hiding SDT, removing richness descriptors) as UI gates. Generalize them into reusable guards.
**Effort:** Small–medium (sanitizer ~an afternoon; provenance check scoped to the narrative annotations path).
**Status:** partial (ad hoc, UI-layer only).

## 4. Ban the tell (kill AI-isms in generated prose)
**Principle:** Don't ask for "natural" — name the exact banned construction (the antithesis flip "it's not X — it's Y" and its negate-then-pivot family) with WRONG + two RIGHT rewrites and a self-check. Audit your own few-shot examples first; the model faithfully reproduces their shape.
**Where it lands:** the generation prompts in `llm-prompts.ts` + `conversation-engine-live.ts`. (Already spotted one antithesis flip inside an instruction: `llm-prompts.ts:853` "…not just a list of skills.")
**Why for us:** Student- and coach-facing prose should match the warm human voice we hand-calibrated this session.
**Effort:** Small–medium — audit examples, add banned-construction block + self-check, regression test for the tell.
**Status:** gap. Pairs naturally with #1.

## 5. Deploy discipline for the split runtime (Trigger.dev)
**Principle:** Trigger.dev tasks don't ship with the Vercel deploy. Guard it: CI detecting undeployed task changes, deploy version string in the commit, a real post-deploy test invocation before calling anything "live."
**Where it lands:** CI config + the Trigger.dev sync tasks (`src/trigger/**`) and their `src/lib/**` import graph.
**Why for us:** Already a *documented* recurring pain (the whole Trigger.dev section in CLAUDE.md exists because of it). Cheap operational insurance.
**Effort:** Small — a CI guardrail + commit convention + smoke invocation.
**Status:** gap (the pain is known; the guard isn't built).

## 6. Caching + splitting + tiering (in that order)
**Principle:** `cache_control` on a long shared prefix (KV-cache reuse speeds *generation*, not just input cost) → split monolithic sections into parallel sub-calls with `Promise.allSettled` + per-section retries (partial failure ships a partial result, never nothing) → tier models per call (cheap model for extraction/classification, expensive only where resonance-critical).
**Where it lands:** `llm-client.ts` (today: single model `claude-sonnet-4-6`, **no** `cache_control`). Tier `autoTagWork` (extraction, runs on *every* synced submission — highest volume) → Haiku; keep narrative/synthesis on Sonnet/Opus. Cache the shared system-prompt prefix. Split per-skill narrative generation with allSettled.
**Why for us:** Cost/latency, and it matters *more* right as Phase 2 adds surfaces + data volume. Do it before the data grows, not after.
**Caveat:** `Promise.allSettled` is fine for parallel *LLM* calls — but NOT for Trigger.dev `triggerAndWait`/`wait` (CLAUDE.md rule). Keep the two straight.
**Effort:** Medium.
**Status:** gap.

## 7. Single-source-of-truth pre-passes
**Principle:** Parallel generation creates consistency bugs (their rate card and proposal quoted different prices). Fix: one small serial call derives the canonical facts, then every parallel artifact quotes it verbatim.
**Where it lands:** as the career + narrative + coach surfaces all describe the same skills from independent LLM calls, they will drift ("narrative vs career framing of the same skill"). Derive the student's canonical skill-state once; feed every surface.
**Why for us:** Lower urgency now, rising fast — cheapest to adopt *before* there are three independent generators (i.e. now-ish, as Phase 2 builds them out).
**Effort:** Medium.
**Status:** gap.

---

## Suggested sequence
1. **#1 Mirror the student's words** — thesis, design-led. *Brainstorm now.*
2. **#2 Persona walkthroughs → guards** + **#3 code guarantees** — cheap, stop shipping Yanita-class bugs; pairs with #1's testing.
3. **#4 Ban the tell** — prompt audit alongside #1 (same prose surfaces).
4. **#5 Deploy discipline** — independent, do anytime; addresses a known pain.
5. **#6 Caching + tiering** and **#7 single-source-of-truth** — before Phase 2 scales data + surfaces.
