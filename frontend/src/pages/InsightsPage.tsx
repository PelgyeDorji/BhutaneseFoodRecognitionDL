import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Bar, InlineError, PageTitle, Panel } from '../components/ui'
import { WeaveChart } from '../components/WeaveChart'
import { percent, plural } from '../lib/format'
import { useStats } from '../lib/queries'
import type { Stats } from '../lib/types'

function finding(stats: Stats) {
  if (stats.total_scans === 0) return 'No scans yet. Insights fill in as you scan and answer.'
  const parts: string[] = []
  if (stats.with_feedback > 0) parts.push(`Right on ${stats.correct} of the ${plural(stats.with_feedback, 'scan')} you answered.`)
  else parts.push(`${plural(stats.total_scans, 'scan')} so far, none answered yet.`)
  const mix = stats.mix_ups[0]
  if (mix) parts.push(`Most often confused: ${mix.was_name} taken for ${mix.said_name}.`)
  else if (stats.top_dishes[0]) parts.push(`Most scanned: ${stats.top_dishes[0].name}.`)
  return parts.join(' ')
}

export default function InsightsPage() {
  const { data: stats, isLoading, isError, refetch } = useStats()

  if (isError) {
    return (
      <>
        <PageTitle title="Insights" />
        <InlineError message="Couldn’t load your insights." onRetry={() => refetch()} />
      </>
    )
  }

  const fourteen = stats?.last_14_days.reduce((sum, d) => sum + d.count, 0) ?? 0
  const topMax = Math.max(1, ...(stats?.top_dishes.map((d) => d.count) ?? []))

  const counts = [
    { label: 'Scans', value: stats ? stats.total_scans.toLocaleString('en-GB') : null },
    { label: 'Answered by you', value: stats ? stats.with_feedback.toLocaleString('en-GB') : null },
    { label: 'Average confidence', value: stats ? (stats.avg_confidence === null ? '—' : percent(stats.avg_confidence, 1)) : null },
    { label: 'Dishes seen', value: stats ? `${stats.dishes_seen}` : null, suffix: ' of 9' },
  ]

  return (
    <>
      <PageTitle title="Insights" sub={stats ? finding(stats) : 'Loading…'} />

      {/* 12 columns: 3/3/3/3, then 9 + 3, then 6 + 6 — every internal edge meets one above it. */}
      <dl className="mb-4 grid grid-cols-2 overflow-hidden rounded-2xl bg-raised lg:grid-cols-4">
        {counts.map((cell, i) => (
          <div
            key={cell.label}
            className={`border-border px-5 py-4 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <dt className="text-[13px] text-muted">{cell.label}</dt>
            <dd className="num mt-1 text-[24px] leading-tight">
              {cell.value === null ? <Bar className="mt-1 h-6 w-14" /> : cell.value}
              {cell.value !== null && cell.suffix && <span className="text-[14px] text-muted">{cell.suffix}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          className="lg:col-span-9"
          title="Scans in the last 14 days"
          action={<span className="num text-[13px] text-muted">{plural(fourteen, 'scan')}</span>}
        >
          {stats ? <WeaveChart days={stats.last_14_days} /> : <Bar className="h-[190px] w-full" />}
          <p className="mt-3 text-[12px] text-muted">One thread per scan, woven onto its day.</p>
        </Panel>

        <Panel className="lg:col-span-3" title="Accuracy">
          {isLoading || !stats ? (
            <Bar className="h-10 w-24" />
          ) : stats.accuracy === null ? (
            <>
              <p className="num text-[36px] leading-none text-faint">—</p>
              <p className="mt-3 text-[14px] text-muted">
                Answer “Is it right?” after a scan and your accuracy shows here.
              </p>
            </>
          ) : (
            <>
              <p className="num text-[36px] leading-none">{percent(stats.accuracy)}</p>
              <p className="mt-2 text-[14px] text-muted">
                {stats.correct} of {plural(stats.with_feedback, 'answer')} said right
              </p>
              <div className="mt-4 h-2 rounded-full bg-active">
                <div className="h-full rounded-full bg-positive" style={{ width: `${stats.accuracy * 100}%` }} />
              </div>
            </>
          )}
          <p className="mt-6 text-[12px] text-muted">
            From your own answers. The model’s test-set accuracy will be reported separately once it’s trained.
          </p>
        </Panel>

        <Panel className="lg:col-span-6" title="Most scanned">
          {stats && stats.top_dishes.length > 0 ? (
            <ol className="space-y-4">
              {stats.top_dishes.map((dish, index) => (
                <li key={dish.slug}>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-serif text-[16px] font-semibold">{dish.name}</span>
                      <span className="num text-[14px] text-muted">{dish.count}</span>
                    </div>
                    <div className="mt-1.5 h-[3px] rounded-full bg-active">
                      <div
                        className={`h-full rounded-full ${index === 0 ? 'bg-accent' : 'bg-faint/50'}`}
                        style={{ width: `${(dish.count / topMax) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed border-control px-4 py-4 text-[14px] text-muted">
              {stats ? 'Your most-scanned dishes will rank here.' : 'Loading…'}
            </p>
          )}
        </Panel>

        <Panel className="lg:col-span-6" title="Mix-ups you reported">
          {stats && stats.mix_ups.length > 0 ? (
            <table className="w-full text-[14px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th scope="col" className="pb-2 text-left font-normal">It said</th>
                  <th scope="col" className="w-6" aria-hidden="true" />
                  <th scope="col" className="pb-2 text-left font-normal">It was</th>
                  <th scope="col" className="pb-2 text-right font-normal">Times</th>
                </tr>
              </thead>
              <tbody>
                {stats.mix_ups.map((m) => (
                  <tr key={`${m.said}-${m.was}`} className="border-t border-border">
                    <td className="py-2.5 text-muted">{m.said_name}</td>
                    <td className="py-2.5 text-faint">
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </td>
                    <td className="py-2.5 font-medium">{m.was_name}</td>
                    <td className="num py-2.5 text-right">{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="rounded-xl border border-dashed border-control px-4 py-4 text-[14px] text-muted">
              {stats
                ? 'When you mark a scan wrong and pick the right dish, the pair shows here. These are the failure cases for the report.'
                : 'Loading…'}
            </p>
          )}
          {stats && stats.total_scans === 0 && (
            <Link to="/" className="mt-4 inline-block text-[14px] font-medium underline underline-offset-4">
              Scan a dish
            </Link>
          )}
        </Panel>
      </div>
    </>
  )
}
