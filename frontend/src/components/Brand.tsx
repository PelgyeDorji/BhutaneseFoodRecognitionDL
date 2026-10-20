import { Link } from 'react-router-dom'

/** The mark: a bowl of red rice with a single saffron chilli, on maroon. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="flex-none">
      <rect width="32" height="32" rx="8" fill="var(--weave-maroon)" />
      <path d="M6 15h20a10 10 0 0 1-20 0z" fill="#fbf6ee" />
      <path
        d="M12.5 12.5c3-1.2 6.4-1.4 9.3-.4 1 .4 1.1 1.4.2 1.8-2.7 1.2-6.4 1.2-9.6-.1-.8-.3-.7-1 .1-1.3z"
        fill="var(--weave-saffron)"
      />
      <path
        d="M21.3 11.9c.6-1.2 1.6-2 2.9-2.3"
        stroke="var(--weave-green)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg text-ink">
      <Mark />
      <span className="leading-tight">
        <span className="block font-serif text-[19px] font-semibold tracking-[-0.01em]">Druk Lens</span>
        <span className="block whitespace-nowrap text-[12px] text-muted">Bhutanese dishes, named</span>
      </span>
    </Link>
  )
}
