import { useId } from 'react'

/**
 * A strip of kira weave: plain maroon and saffron bands either side of an ivory
 * band carrying the small stepped diamonds of a Bhutanese textile.
 * One repeating SVG pattern, so it tiles at any width without stretching.
 */
export function KiraBand({ height = 24, className = '' }: { height?: number; className?: string }) {
  const id = `kira-${useId().replace(/:/g, '')}`
  return (
    <svg aria-hidden="true" className={`block w-full ${className}`} height={height}>
      <defs>
        <pattern
          id={id}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${height / 24})`}
        >
          <rect width="24" height="24" fill="var(--weave-ivory)" />
          <rect width="24" height="4" fill="var(--weave-maroon)" />
          <rect y="4" width="24" height="1.5" fill="var(--weave-saffron)" />
          <rect y="18.5" width="24" height="1.5" fill="var(--weave-saffron)" />
          <rect y="20" width="24" height="4" fill="var(--weave-maroon)" />
          <path d="M12 7.5 L16.5 12 L12 16.5 L7.5 12 Z" fill="var(--weave-green)" />
          <path d="M12 9.5 L14.5 12 L12 14.5 L9.5 12 Z" fill="var(--weave-ivory)" />
          <rect x="11" y="11" width="2" height="2" fill="var(--weave-maroon)" />
          <path d="M0 9 L3 12 L0 15 Z" fill="var(--weave-ink)" />
          <path d="M24 9 L21 12 L24 15 Z" fill="var(--weave-ink)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
