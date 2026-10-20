import { shortDay } from '../lib/format'

type Day = { day: string; count: number }

const HEIGHT = 168
const THREAD_GAP = 3
const MAX_THREAD = 8

/**
 * Scans per day as a weave: each day is a warp (the faint vertical cord) and
 * each scan one saffron weft thread laid across it, stacked from the base.
 * A unit chart, so small numbers are drawn at their real size.
 */
export function WeaveChart({ days }: { days: Day[] }) {
  const max = Math.max(4, ...days.map((d) => d.count))
  const thread = Math.max(2, Math.min(MAX_THREAD, (HEIGHT - 24 - THREAD_GAP * max) / max))
  const last = days.length - 1
  const total = days.reduce((sum, d) => sum + d.count, 0)

  return (
    <figure>
      <div
        className="grid items-end gap-1.5 sm:gap-2.5"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: HEIGHT }}
        role="img"
        aria-label={`Scans per day for the last ${days.length} days: ${total} in all.`}
      >
        {days.map((d, i) => (
          <div key={d.day} className="relative flex h-full flex-col items-center justify-end">
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
            {d.count > 0 && (
              <span className={`num relative mb-1.5 text-[12px] ${i === last ? 'font-semibold text-ink' : 'text-muted'}`}>
                {d.count}
              </span>
            )}
            <div className="relative flex w-full flex-col-reverse" style={{ gap: THREAD_GAP }}>
              {Array.from({ length: d.count }, (_, t) => (
                <span
                  key={t}
                  className="block w-full rounded-[2px] bg-accent"
                  style={{ height: thread, opacity: t % 2 ? 0.82 : 1 }}
                />
              ))}
            </div>
            <span className="relative mt-1 block h-[2px] w-full bg-ink/70" aria-hidden="true" />
          </div>
        ))}
      </div>
      <figcaption
        className="mt-2 grid text-[12px] text-muted"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d, i) => (
          <span key={d.day} className={`text-center ${i === last ? 'font-medium text-ink' : ''}`}>
            {i === last ? 'Today' : i % 3 === 1 ? shortDay(d.day) : ''}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
