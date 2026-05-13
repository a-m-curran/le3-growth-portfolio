/**
 * Shared SVG filter primitives the archetypes use to get a consistent
 * sense of depth: soft drop shadow under shapes, subtle inset shadow
 * for cupped forms, glow for light-source elements (flames, beams),
 * and a radial-gradient ground patch for cast-shadow contact.
 *
 * Each archetype that wants these should include
 * `<ArtworkFilters seed={seed} />` inside its own `<defs>` block, then
 * reference the filters by id (use `artworkFilterIds(seed)` from
 * `./shared.ts` so the ids match). The seed scope prevents id
 * collisions when multiple archetypes render on the same page.
 *
 * Returns a fragment so the caller controls where it sits inside
 * `<defs>`. Doesn't render its own `<defs>` wrapper.
 */
interface Props {
  seed: string
  /**
   * Tunable shadow strength. 0..1, default 0.35.
   * Higher = darker shadow, lower = more diffuse.
   */
  shadowOpacity?: number
}

export function ArtworkFilters({ seed, shadowOpacity = 0.35 }: Props) {
  return (
    <>
      {/* Drop shadow — soft Gaussian blur offset down a few px. Used
          on the primary masses of each artwork so they pop forward
          from the pillar's background tint. */}
      <filter id={`drop-${seed}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
        <feOffset dx="0" dy="2" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope={shadowOpacity} />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Inner shadow — Gaussian blur of inverted alpha. Gives a
          subtle "scooped" look to ripples, river bed, etc. Use
          sparingly; too much reads as muddy. */}
      <filter id={`inset-${seed}`}>
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
        <feOffset dx="0" dy="1" result="offsetblur" />
        <feFlood floodColor="black" floodOpacity={shadowOpacity * 0.8} />
        <feComposite in2="offsetblur" operator="in" />
        <feComposite in2="SourceGraphic" operator="over" />
      </filter>

      {/* Glow — bright Gaussian blur composited over the source.
          Used for light-emitting elements: flame, lighthouse beam,
          constellation stars, bloom highlights. */}
      <filter id={`glow-${seed}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Ground gradient — soft radial fade from dark center to
          transparent edges. Each archetype uses an ellipse filled
          with this to create the contact-point shadow beneath its
          form (more realistic than a flat semi-opaque ellipse). */}
      <radialGradient id={`ground-${seed}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="black" stopOpacity={shadowOpacity * 0.85} />
        <stop offset="60%" stopColor="black" stopOpacity={shadowOpacity * 0.3} />
        <stop offset="100%" stopColor="black" stopOpacity="0" />
      </radialGradient>
    </>
  )
}
