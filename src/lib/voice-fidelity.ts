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

const BANNED_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'its-not-its', re: /\bit'?s not\b[^.!?]{0,60}?\bit'?s\b/i },
  { name: 'not-just-pivot', re: /\bnot just\b[^.!?]{0,60}?(?:—|--|\bbut\b)/i },
  { name: 'isnt-its', re: /\bisn'?t\b[^.!?]{0,60}?\bit'?s\b/i },
  { name: 'doesnt-just-pivot', re: /\bdoesn'?t just\b[^.!?]{0,60}?(?:—|--|\bit\b)/i },
]

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[''′`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => PRONOUN_MAP[w] ?? w)
}

export interface VoiceFidelityResult {
  groundedPhrases: string[]
  groundedPhraseCount: number
  coverage: number
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

  const corpusNgrams = new Set<string>()
  const maxN = Math.min(MAX_SPAN, corpusWords.length)
  for (let n = MIN_SPAN; n <= maxN; n++) {
    for (let i = 0; i + n <= corpusWords.length; i++) {
      corpusNgrams.add(corpusWords.slice(i, i + n).join(' '))
    }
  }

  const grounded = new Set<string>()
  const covered = new Array<boolean>(genWords.length).fill(false)
  // Walk left-to-right, greedily taking the LONGEST student span at each
  // position, then SKIP PAST it. Advancing past the match (rather than by
  // one word) is what makes each contiguous grounded region count once —
  // otherwise a single long verbatim overlap inflates groundedPhraseCount
  // by emitting a distinct sub-span at every offset inside it.
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
