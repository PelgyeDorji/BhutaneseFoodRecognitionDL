import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfidenceMeter } from '../components/Confidence'
import { FeedbackForm, FeedbackStatus } from '../components/FeedbackForm'
import { Bar, Button, InlineError, PageTitle } from '../components/ui'
import { api } from '../lib/api'
import { percent, when } from '../lib/format'
import { useDishes, useStats } from '../lib/queries'
import type { Prediction } from '../lib/types'

const PAGE = 24
type Answer = 'none' | 'correct' | 'wrong'

const ANSWERS: { value: Answer | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'none', label: 'Not checked' },
  { value: 'correct', label: 'Correct' },
  { value: 'wrong', label: 'Wrong' },
]

function Detail({ prediction, onClose }: { prediction: Prediction; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: stats } = useStats()
  const [current, setCurrent] = useState(prediction)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => setCurrent(prediction), [prediction])
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])

  const remove = useMutation({
    mutationFn: () => api.deletePrediction(prediction.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Scan deleted.')
      onClose()
    },
    onError: () => toast.error('Could not delete that scan.'),
  })

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
        aria-label={`Scan of ${current.predicted_name}`}
        // taste-skill-ignore: a dialog that floats over the page is allowed a shadow
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col overflow-y-auto bg-sheet shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex h-14 flex-none items-center justify-between px-5">
          <p className="text-[13px] text-muted">{when(current.created_at)}</p>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center hover:bg-active"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <img src={current.image_url} alt={`Your photo, recognised as ${current.predicted_name}`} className="aspect-[4/3] w-full object-cover" />
        <div className="space-y-6 p-5">
          <div>
            <div className="flex items-start gap-4">
              <h2 className="min-w-0 flex-1 font-serif text-[26px] font-semibold leading-tight">{current.predicted_name}</h2>
              <p className="num pt-0.5 text-[26px] leading-tight">{percent(current.confidence)}</p>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {current.is_placeholder ? 'Demo answer from the placeholder model' : `Model: ${current.model_used}`}
            </p>
            <div className="mt-4">
              <ConfidenceMeter value={current.confidence} threshold={stats?.confidence_threshold ?? 0.6} />
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <FeedbackForm prediction={current} onSaved={setCurrent} />
          </div>
          <div className="border-t border-border pt-5">
            {confirming ? (
              <div>
                <p className="text-[14px] text-ink">Delete this scan and its photo? This can’t be undone.</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" busy={remove.isPending} onClick={() => remove.mutate()}>
                    Delete scan
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="-ml-2 text-negative" onClick={() => setConfirming(true)}>
                <Trash2 className="size-4" aria-hidden="true" /> Delete scan
              </Button>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  )
}

export default function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const dish = params.get('dish') ?? ''
  const answer = (params.get('answer') ?? '') as Answer | ''
  const openId = Number(params.get('open')) || null
  const { data: dishes = [] } = useDishes()

  const query = useInfiniteQuery({
    queryKey: ['history', 'list', { dish, answer }],
    queryFn: ({ pageParam }) =>
      api.history({ limit: PAGE, offset: pageParam, dish: dish || undefined, answer: answer || undefined }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0
  const open = rows.find((row) => row.id === openId) ?? null

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key !== 'open' })
  }

  const filtered = Boolean(dish || answer)

  return (
    <>
      <PageTitle
        title="History"
        sub={
          query.isLoading
            ? 'Loading your scans…'
            : total === 0 && !filtered
              ? 'Nothing scanned yet.'
              : `${total.toLocaleString('en-GB')} ${total === 1 ? 'scan' : 'scans'}${filtered ? ' match these filters' : ', newest first'}.`
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto bg-raised p-1" role="group" aria-label="Filter by your answer">
          {ANSWERS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => set('answer', option.value || null)}
              aria-pressed={answer === option.value}
              className={clsx(
                'h-8 flex-none whitespace-nowrap px-3.5 text-[13px] transition-colors duration-150',
                answer === option.value ? 'bg-surface font-medium text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="dish-filter">
          Dish
        </label>
        <select
          id="dish-filter"
          value={dish}
          onChange={(event) => set('dish', event.target.value || null)}
          className="h-10 border border-control bg-surface px-4 pr-8 text-[14px] text-ink"
        >
          <option value="">Every dish</option>
          {dishes.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            className="text-[14px] font-medium text-ink underline-offset-4 hover:underline"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            Clear filters
          </button>
        )}
      </div>

      {query.isError ? (
        <InlineError message="Couldn’t load your history." onRetry={() => query.refetch()} />
      ) : (
        <div className="overflow-hidden bg-raised">
          <table className="w-full text-left text-[14px]">
            <thead className="hidden text-[12px] text-muted md:table-header-group">
              <tr>
                <th scope="col" className="h-10 px-5 font-normal">Dish</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Confidence</th>
                <th scope="col" className="h-10 px-5 font-normal">Your answer</th>
                <th scope="col" className="h-10 px-5 text-right font-normal">Scanned</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-t border-border first:border-t-0">
                    <td className="px-5 py-3" colSpan={4}>
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
                  className="group cursor-pointer border-t border-border transition-colors first:border-t-0 hover:bg-sheet md:first:border-t"
                  onClick={() => set('open', String(row.id))}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={row.thumb_url} alt="" className="size-12 flex-none object-cover" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-serif text-[16px] font-semibold text-ink focus-visible:underline"
                          onClick={(event) => {
                            event.stopPropagation()
                            set('open', String(row.id))
                          }}
                        >
                          {row.predicted_name}
                        </button>
                        <p className="mt-0.5 flex items-center gap-x-2 whitespace-nowrap text-[13px] text-muted md:hidden">
                          <span className="num">{percent(row.confidence)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{when(row.created_at)}</span>
                        </p>
                      </div>
                      <div className="ml-auto md:hidden">
                        <FeedbackStatus prediction={row} />
                      </div>
                    </div>
                  </td>
                  <td className="num hidden px-5 py-3 text-right text-ink md:table-cell">
                    {percent(row.confidence)}
                    {!row.is_confident && <span className="block text-[12px] text-muted">below threshold</span>}
                  </td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    <FeedbackStatus prediction={row} />
                  </td>
                  <td className="num hidden whitespace-nowrap px-5 py-3 text-right text-muted md:table-cell">
                    {when(row.created_at)}
                  </td>
                </tr>
              ))}
              {!query.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-5">
                    <p className="border border-dashed border-control px-4 py-4 text-[14px] text-muted">
                      {filtered ? (
                        'No scans match these filters.'
                      ) : (
                        <>
                          Nothing here yet.{' '}
                          <Link to="/" className="font-medium text-ink underline underline-offset-4">
                            Scan your first dish
                          </Link>
                          .
                        </>
                      )}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span className="num">
            Showing 1–{rows.length} of {total.toLocaleString('en-GB')}
          </span>
          {query.hasNextPage && (
            <Button size="sm" busy={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              Load more
            </Button>
          )}
        </div>
      )}

      <AnimatePresence>{open && <Detail key={open.id} prediction={open} onClose={() => set('open', null)} />}</AnimatePresence>
    </>
  )
}
