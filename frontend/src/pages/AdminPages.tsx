import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowRight, Download, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ConfidenceMeter } from '../components/Confidence'
import { FeedbackStatus } from '../components/FeedbackForm'
import { Bar, Button, InlineError, PageTitle, Panel } from '../components/ui'
import { api } from '../lib/api'
import { percent, plural, when } from '../lib/format'
import { useDishes } from '../lib/queries'
import type { AdminScan, Answer } from '../lib/types'

const PAGE = 24

function useSummary() {
  return useQuery({ queryKey: ['admin', 'summary'], queryFn: api.admin.summary })
}

/** Totals across every account, as one divided strip. */
function SummaryStrip() {
  const { data } = useSummary()
  const cells = [
    { label: 'Users', value: data?.users.toLocaleString('en-GB') },
    { label: 'Scans', value: data?.scans.toLocaleString('en-GB') },
    { label: 'Answered', value: data?.answered.toLocaleString('en-GB') },
    { label: 'Said right', value: data ? (data.accuracy === null ? '—' : percent(data.accuracy)) : undefined },
  ]
  return (
    <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-2xl bg-raised lg:grid-cols-4">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={clsx(
            'border-border px-5 py-4',
            i % 2 === 1 && 'border-l',
            i >= 2 && 'border-t lg:border-t-0',
            i === 2 && 'lg:border-l',
          )}
        >
          <dt className="text-[13px] text-muted">{cell.label}</dt>
          <dd className="num mt-1 text-[24px] leading-tight">
            {cell.value === undefined ? <Bar className="mt-1 h-6 w-14" /> : cell.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function useParam(key: string) {
  const [params, setParams] = useSearchParams()
  const set = (value: string | null, replace = true) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace })
  }
  return [params.get(key) ?? '', set] as const
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-control px-4 py-4 text-[14px] text-muted">{children}</p>
  )
}

function LoadMore({ shown, total, hasMore, busy, onMore }: { shown: number; total: number; hasMore: boolean; busy: boolean; onMore: () => void }) {
  if (shown === 0) return null
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <span className="num">
        Showing 1–{shown} of {total.toLocaleString('en-GB')}
      </span>
      {hasMore && (
        <Button size="sm" busy={busy} onClick={onMore}>
          Load more
        </Button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Users */

export function AdminUsersPage() {
  const [q, setQ] = useParam('q')
  const [draft, setDraft] = useState(q)

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => draft !== q && setQ(draft.trim() || null), 250)
    return () => window.clearTimeout(id)
  }, [draft, q, setQ])

  const query = useInfiniteQuery({
    queryKey: ['admin', 'users', q],
    queryFn: ({ pageParam }) => api.admin.users({ q: q || undefined, limit: 50, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0

  return (
    <>
      <PageTitle title="Users" sub="Everyone with an account, newest first. Open a person to see their scans." />
      <SummaryStrip />

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="user-search" className="sr-only">
          Search by name or email
        </label>
        <input
          id="user-search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search by name or email"
          className="h-10 w-full rounded-full border border-control bg-surface pl-10 pr-4 text-ink placeholder:text-faint"
        />
      </div>

      {query.isError ? (
        <InlineError message="Couldn’t load users." onRetry={() => query.refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-raised">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="text-[12px] text-muted">
              <tr>
                <th scope="col" className="h-10 px-5 font-normal">Person</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Scans</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Answered</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Said right</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Last scan</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Joined</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={6} className="px-5 py-3.5">
                      <Bar className="h-4 w-48" />
                    </td>
                  </tr>
                ))}
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-border transition-colors hover:bg-sheet">
                  <td className="px-5 py-3">
                    <Link to={`/admin/scans?user=${u.id}`} className="group block min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink group-hover:underline group-hover:underline-offset-4">{u.name}</span>
                        {u.is_admin && (
                          <span className="inline-flex h-5 flex-none items-center rounded-full bg-active px-2 text-[11px] font-medium text-muted">
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-muted">{u.email}</span>
                    </Link>
                  </td>
                  <td className="num px-5 py-3 text-right">{u.scans}</td>
                  <td className="num px-5 py-3 text-right">{u.answered}</td>
                  <td className="num px-5 py-3 text-right">
                    {u.answered ? percent(u.correct / u.answered) : <span className="text-faint">—</span>}
                  </td>
                  <td className="num whitespace-nowrap px-5 py-3 text-right text-muted">
                    {u.last_scan_at ? when(u.last_scan_at) : '—'}
                  </td>
                  <td className="num whitespace-nowrap px-5 py-3 text-right text-muted">{u.created_at.slice(0, 10)}</td>
                </tr>
              ))}
              {!query.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-5">
                    <Empty>{q ? `No one matches “${q}”.` : 'No accounts yet.'}</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore
        shown={rows.length}
        total={total}
        hasMore={Boolean(query.hasNextPage)}
        busy={query.isFetchingNextPage}
        onMore={() => query.fetchNextPage()}
      />
    </>
  )
}

/* ---------------------------------------------------------------- Scans */

function ScanDetail({ scan, threshold, onClose }: { scan: AdminScan; threshold: number; onClose: () => void }) {
  const { data: dishes } = useDishes()
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])

  const actual = scan.feedback?.correct_food
    ? (dishes?.find((d) => d.slug === scan.feedback?.correct_food)?.name ?? scan.feedback.correct_food)
    : null

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`Scan by ${scan.user.name}`}
        // taste-skill-ignore: a dialog that floats over the page is allowed a shadow
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col overflow-y-auto bg-sheet shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex h-14 flex-none items-center justify-between px-5">
          <p className="min-w-0 truncate text-[13px] text-muted">
            {scan.user.name} · {when(scan.created_at)}
          </p>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-active" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <img src={scan.image_url} alt={`Photo scanned by ${scan.user.name}`} className="aspect-[4/3] w-full object-cover" />
        <div className="space-y-6 p-5">
          <div>
            <div className="flex items-start gap-4">
              <h2 className="min-w-0 flex-1 font-serif text-[26px] font-semibold leading-tight">{scan.predicted_name}</h2>
              <p className="num pt-0.5 text-[26px] leading-tight">{percent(scan.confidence)}</p>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {scan.is_placeholder ? 'Demo answer from the placeholder model' : `Model: ${scan.model_used}`}
            </p>
            <div className="mt-4">
              <ConfidenceMeter value={scan.confidence} threshold={threshold} />
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-[14px] font-semibold">Their answer</h3>
            {scan.feedback ? (
              <div className="space-y-2 text-[14px]">
                <FeedbackStatus prediction={scan} />
                {actual && <p>They said it was <span className="font-medium">{actual}</span>.</p>}
                {scan.feedback.comment && <p className="text-muted">“{scan.feedback.comment}”</p>}
              </div>
            ) : (
              <p className="text-[14px] text-muted">Not answered yet.</p>
            )}
          </div>
          <div className="border-t border-border pt-5 text-[14px]">
            <h3 className="mb-1 text-[14px] font-semibold">Scanned by</h3>
            <p>{scan.user.name}</p>
            <p className="text-muted">{scan.user.email}</p>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

const ANSWERS: { value: Answer | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'none', label: 'Not answered' },
  { value: 'correct', label: 'Correct' },
  { value: 'wrong', label: 'Wrong' },
]

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-raised p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={clsx(
            'h-8 flex-none whitespace-nowrap rounded-full px-3.5 text-[13px] transition-colors duration-150',
            value === option.value ? 'bg-surface font-medium text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The shared list of scans behind both admin scan views. */
function useAdminScans(filters: { user_id?: number; dish?: string; answer?: Answer }) {
  const query = useInfiniteQuery({
    queryKey: ['admin', 'scans', filters],
    queryFn: ({ pageParam }) => api.admin.scans({ ...filters, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  return { query, rows, total: query.data?.pages[0]?.total ?? 0 }
}

function useThreshold() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  return data?.confidence_threshold ?? 0.6
}

export function AdminScansPage() {
  const [userParam, setUser] = useParam('user')
  const [dish, setDish] = useParam('dish')
  const [answer, setAnswer] = useParam('answer')
  const [open, setOpen] = useParam('open')
  const { data: dishes = [] } = useDishes()
  const threshold = useThreshold()
  const userId = Number(userParam) || undefined

  const { query, rows, total } = useAdminScans({
    user_id: userId,
    dish: dish || undefined,
    answer: (answer || undefined) as Answer | undefined,
  })
  const person = userId ? rows[0]?.user : undefined
  const selected = rows.find((r) => String(r.id) === open) ?? null
  const filtered = Boolean(userId || dish || answer)

  return (
    <>
      <PageTitle
        title="All scans"
        sub={
          query.isLoading
            ? 'Loading…'
            : `${plural(total, 'scan')}${person ? ` by ${person.name}` : ' across every account'}, newest first.`
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Filter by answer"
          value={(answer || '') as Answer | ''}
          options={ANSWERS}
          onChange={(v) => setAnswer(v || null)}
        />
        <label className="sr-only" htmlFor="admin-dish">
          Dish
        </label>
        <select
          id="admin-dish"
          value={dish}
          onChange={(e) => setDish(e.target.value || null)}
          className="h-10 rounded-full border border-control bg-surface px-4 pr-8 text-[14px] text-ink"
        >
          <option value="">Every dish</option>
          {dishes.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        {userId && (
          <span className="inline-flex h-10 items-center gap-1 rounded-full bg-active pl-4 pr-1.5 text-[14px]">
            {person ? person.name : `User ${userId}`}
            <button
              type="button"
              onClick={() => setUser(null)}
              className="grid size-7 place-items-center rounded-full hover:bg-surface"
              aria-label="Show every user"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      {query.isError ? (
        <InlineError message="Couldn’t load scans." onRetry={() => query.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-raised">
          <table className="w-full text-left text-[14px]">
            <thead className="hidden text-[12px] text-muted md:table-header-group">
              <tr>
                <th scope="col" className="h-10 px-5 font-normal">Dish</th>
                <th scope="col" className="h-10 px-5 font-normal">Scanned by</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Confidence</th>
                <th scope="col" className="h-10 px-5 font-normal">Their answer</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-t border-border first:border-t-0 md:first:border-t">
                    <td colSpan={5} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Bar className="size-12" />
                        <Bar className="h-4 w-40" />
                      </div>
                    </td>
                  </tr>
                ))}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-border transition-colors first:border-t-0 hover:bg-sheet md:first:border-t"
                  onClick={() => setOpen(String(row.id), false)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={row.thumb_url} alt="" className="size-12 flex-none rounded-lg object-cover" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-serif text-[16px] font-semibold focus-visible:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpen(String(row.id), false)
                          }}
                        >
                          {row.predicted_name}
                        </button>
                        <p className="mt-0.5 flex items-center gap-x-2 whitespace-nowrap text-[13px] text-muted md:hidden">
                          <span className="truncate">{row.user.name}</span>
                          <span aria-hidden="true">·</span>
                          <span className="num">{percent(row.confidence)}</span>
                        </p>
                      </div>
                      <div className="ml-auto md:hidden">
                        <FeedbackStatus prediction={row} />
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    <span className="block max-w-[200px] truncate">{row.user.name}</span>
                    <span className="block max-w-[200px] truncate text-[13px] text-muted">{row.user.email}</span>
                  </td>
                  <td className="num hidden px-5 py-3 text-right md:table-cell">{percent(row.confidence)}</td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    <FeedbackStatus prediction={row} />
                  </td>
                  <td className="num hidden whitespace-nowrap px-5 py-3 text-right text-muted md:table-cell">{when(row.created_at)}</td>
                </tr>
              ))}
              {!query.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-5">
                    <Empty>{filtered ? 'No scans match these filters.' : 'Nobody has scanned a dish yet.'}</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore shown={rows.length} total={total} hasMore={Boolean(query.hasNextPage)} busy={query.isFetchingNextPage} onMore={() => query.fetchNextPage()} />

      <AnimatePresence>
        {selected && <ScanDetail key={selected.id} scan={selected} threshold={threshold} onClose={() => setOpen(null, false)} />}
      </AnimatePresence>
    </>
  )
}

/* ------------------------------------------------------------- Feedback */

const VERDICTS: { value: Answer; label: string }[] = [
  { value: 'answered', label: 'All answers' },
  { value: 'wrong', label: 'Wrong' },
  { value: 'correct', label: 'Correct' },
]

export function AdminFeedbackPage() {
  const [verdictParam, setVerdict] = useParam('answer')
  const [open, setOpen] = useParam('open')
  const verdict = (verdictParam || 'answered') as Answer
  const { data: summary } = useSummary()
  const { data: dishes } = useDishes()
  const threshold = useThreshold()
  const { query, rows, total } = useAdminScans({ answer: verdict })
  const selected = rows.find((r) => String(r.id) === open) ?? null
  const dishName = (slug: string | null) => dishes?.find((d) => d.slug === slug)?.name ?? slug ?? ''

  return (
    <>
      <PageTitle
        title="All feedback"
        sub={
          summary
            ? summary.answered === 0
              ? 'Nobody has answered “Is it right?” yet.'
              : `${summary.correct} of ${plural(summary.answered, 'answer')} said the result was right${summary.accuracy !== null ? ` (${percent(summary.accuracy)})` : ''}.`
            : 'Loading…'
        }
        action={
          <a
            href={api.admin.feedbackCsvUrl}
            download
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4.5 text-[14px] font-medium text-on-primary transition-[transform,background-color] duration-150 hover:bg-primary-hover active:scale-[0.97]"
          >
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div className="mb-4">
            <Segmented label="Filter by verdict" value={verdict} options={VERDICTS} onChange={(v) => setVerdict(v === 'answered' ? null : v)} />
          </div>
          {query.isError ? (
            <InlineError message="Couldn’t load feedback." onRetry={() => query.refetch()} />
          ) : (
            <ul className="space-y-2">
              {query.isLoading &&
                [0, 1, 2].map((i) => (
                  <li key={i} className="flex h-[76px] items-center gap-3 rounded-2xl bg-raised px-4">
                    <Bar className="size-12" />
                    <Bar className="h-4 w-56" />
                  </li>
                ))}
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(String(row.id), false)}
                    className="flex w-full items-start gap-3 rounded-2xl bg-raised px-4 py-3.5 text-left transition-colors hover:bg-active/60"
                  >
                    <img src={row.thumb_url} alt="" className="size-12 flex-none rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-[15px]">
                        {row.feedback?.is_correct ? (
                          <span className="font-serif font-semibold">{row.predicted_name}</span>
                        ) : (
                          <>
                            <span className="text-muted line-through decoration-faint">{row.predicted_name}</span>
                            <ArrowRight className="size-3.5 text-faint" aria-hidden="true" />
                            <span className="font-serif font-semibold">{dishName(row.feedback?.correct_food ?? null)}</span>
                          </>
                        )}
                      </p>
                      {row.feedback?.comment && <p className="mt-1 line-clamp-2 text-[14px] text-ink">“{row.feedback.comment}”</p>}
                      <p className="mt-1 truncate text-[13px] text-muted">
                        {row.user.name} · <span className="num">{percent(row.confidence)}</span> · {when(row.feedback?.created_at ?? row.created_at)}
                      </p>
                    </div>
                    <div className="flex-none pt-0.5">
                      <FeedbackStatus prediction={row} />
                    </div>
                  </button>
                </li>
              ))}
              {!query.isLoading && rows.length === 0 && (
                <li>
                  <Empty>{verdict === 'answered' ? 'No answers yet.' : `No ${verdict} answers yet.`}</Empty>
                </li>
              )}
            </ul>
          )}
          <LoadMore shown={rows.length} total={total} hasMore={Boolean(query.hasNextPage)} busy={query.isFetchingNextPage} onMore={() => query.fetchNextPage()} />
        </div>

        <div className="lg:col-span-4">
          <Panel title="Most common mix-ups">
            {summary && summary.mix_ups.length > 0 ? (
              <table className="w-full text-[14px]">
                <thead className="text-[12px] text-muted">
                  <tr>
                    <th scope="col" className="pb-2 text-left font-normal">It said</th>
                    <th scope="col" className="pb-2 text-left font-normal">It was</th>
                    <th scope="col" className="pb-2 text-right font-normal">Times</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.mix_ups.map((m) => (
                    <tr key={`${m.said}-${m.was}`} className="border-t border-border">
                      <td className="py-2.5 pr-2 text-muted">{m.said_name}</td>
                      <td className="py-2.5 pr-2 font-medium">{m.was_name}</td>
                      <td className="num py-2.5 text-right">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>{summary ? 'Wrong answers that name the right dish are counted here.' : 'Loading…'}</Empty>
            )}
            <p className="mt-4 text-[12px] text-muted">
              The CSV lists every answer with its image file, ready to review for the next training round.
            </p>
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {selected && <ScanDetail key={selected.id} scan={selected} threshold={threshold} onClose={() => setOpen(null, false)} />}
      </AnimatePresence>
    </>
  )
}
