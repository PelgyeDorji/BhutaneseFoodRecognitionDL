import { percent } from '../lib/format'

/**
 * Confidence as a bullet: the fill is the true ratio, the tick is the threshold
 * below which the app says it is not sure.
 */
export function ConfidenceMeter({ value, threshold }: { value: number; threshold: number }) {
  return (
    <div>
      <div className="relative h-2 bg-active" role="presentation">
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${value * 100}%` }} />
        <div
          className="absolute -inset-y-1 w-px bg-ink"
          style={{ left: `${threshold * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-2 h-4 text-[12px] text-muted">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${threshold * 100}%` }}>
          Sure from {percent(threshold)}
        </span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  )
}

/** The other candidates, as a short ranked list with thin proportional bars. */
export function Candidates({ items }: { items: { slug: string; name: string; confidence: number }[] }) {
  const top = Math.max(...items.map((item) => item.confidence), 0.0001)
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.slug}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className={index === 0 ? 'font-medium text-ink' : 'text-ink'}>{item.name}</span>
            <span className="num text-muted">{percent(item.confidence, 1)}</span>
          </div>
          <div className="mt-1.5 h-[3px] bg-active">
            <div
              className={index === 0 ? 'h-full bg-accent' : 'h-full bg-faint/50'}
              style={{ width: `${(item.confidence / top) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
