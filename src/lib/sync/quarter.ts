/**
 * Calendar-quarter-at-call-time, in canonical "Season YYYY" form.
 *
 * Extracted from sync-course.ts so it can be imported by
 * src/lib/d2l/mappers.ts (the deriveQuarter helper's safety-net
 * fallback) without a circular dep between d2l and sync modules.
 *
 * No behavior change from the prior in-file definition.
 */
export function currentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}
