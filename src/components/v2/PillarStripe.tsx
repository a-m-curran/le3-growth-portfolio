import { getPillarPalette } from '@/lib/constants'

/**
 * Inline helper: get the style object for a pillar-tinted left
 * border on a list-row card. Apply via spread:
 *
 *   <li style={pillarStripeStyle(item.primaryPillar)}>...</li>
 *
 * Returns a transparent border for null/unknown pillars so the
 * caller doesn't have to branch — items without a pillar simply
 * don't show the stripe.
 *
 * Width is 3px, applied as `borderLeftWidth` + `borderLeftColor`
 * so callers can compose with their existing rounded-corner +
 * background classes without conflict.
 */
export function pillarStripeStyle(
  pillarName: string | null | undefined
): React.CSSProperties {
  if (!pillarName) {
    return { borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: 'transparent' }
  }
  const p = getPillarPalette(pillarName)
  return {
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: p.surfaceBorder,
  }
}

/**
 * Small label badge showing the pillar name in its surface text
 * color on its surface bg. Useful as a kicker above a card title
 * when we want explicit pillar context, not just a stripe.
 *
 * Returns null for unknown pillars so callers can drop it inline
 * without guarding.
 */
export function PillarBadge({ pillarName }: { pillarName: string | null | undefined }) {
  if (!pillarName) return null
  const p = getPillarPalette(pillarName)
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold"
      style={{
        backgroundColor: p.surface,
        color: p.surfaceText,
        border: `1px solid ${p.surfaceBorder}88`,
      }}
    >
      {pillarName}
    </span>
  )
}
