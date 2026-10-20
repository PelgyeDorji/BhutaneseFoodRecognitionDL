import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Camera, ImageUp, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '../auth/AuthContext'
import { CameraCapture } from '../components/CameraCapture'
import { Candidates, ConfidenceMeter } from '../components/Confidence'
import { FeedbackForm } from '../components/FeedbackForm'
import { Bar, Button, InlineError, Panel } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { percent, plural, when } from '../lib/format'
import { ACCEPT_ATTR, MAX_UPLOAD_MB, PhotoProblem, preparePhoto } from '../lib/image'
import { useDishes, useRecent, useStats } from '../lib/queries'
import type { PredictResult, Prediction, Stats } from '../lib/types'

const DISH_COUNT = 9

function Greeting({ stats }: { stats?: Stats }) {
  const { user } = useAuth()
  const { data: recent } = useRecent()
  const first = user?.name.split(' ')[0] ?? ''
  const last = recent?.items[0]

  let line = 'Photograph a plate of Bhutanese food and Druk Lens will name the dish.'
  if (stats && stats.total_scans > 0 && last) {
    line = `${plural(stats.total_scans, 'dish', 'dishes')} scanned so far. The last was ${last.predicted_name}, ${when(last.created_at).toLowerCase()}.`
  }

  return (
    <div className="mb-10">
      <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] sm:text-[34px]">
        Kuzu Zangpo, {first}.
      </h1>
      <p className="mt-2 text-[16px] text-muted">{line}</p>
    </div>
  )
}

function Counts({ stats, loading }: { stats?: Stats; loading: boolean }) {
  const cells = [
    { label: 'Scans', value: stats?.total_scans, note: 'Photos you have checked' },
    { label: 'Answered by you', value: stats?.with_feedback, note: 'Marked right or wrong' },
    { label: 'Correct', value: stats?.correct, note: stats?.with_feedback ? `of ${stats.with_feedback} answered` : 'None answered yet' },
    { label: 'Dishes seen', value: stats?.dishes_seen, suffix: ` of ${DISH_COUNT}`, note: 'Different dishes named' },
  ]
  return (
    <dl className="mb-4 grid grid-cols-2 overflow-hidden bg-raised lg:grid-cols-4">
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
          <dd className="num mt-1 text-[26px] leading-tight text-ink">
            {loading ? <Bar className="mt-1 h-7 w-12" /> : (cell.value ?? '—')}
            {!loading && cell.suffix && <span className="text-[15px] text-muted">{cell.suffix}</span>}
          </dd>
          <dd className="mt-1 text-[12px] text-muted">{cell.note}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Before the first scan, the side panel lists what Druk Lens can recognise. */
function KnownDishes() {
  const { data: dishes = [] } = useDishes()
  return (
    <div>
      <p className="text-[14px] text-muted">Nothing scanned yet. It knows these nine:</p>
      <ul className="mt-3 space-y-2">
        {dishes.map((dish) => (
          <li key={dish.slug} className="text-[14px] leading-tight">
            <span className="block truncate font-serif text-[15px] font-semibold">{dish.name}</span>
            <span className="block truncate text-[12px] text-muted">{dish.tagline}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Recent() {
  const { data, isLoading, isError, refetch } = useRecent()
  return (
    <Panel
      title="Recent scans"
      action={
        data && data.total > 0 ? (
          <Link to="/history" className="text-[13px] font-medium text-ink underline-offset-4 hover:underline">
            View all {data.total}
          </Link>
        ) : null
      }
      className="h-full"
    >
      {isLoading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex h-[60px] items-center gap-3 bg-sheet px-3">
              <Bar className="size-10" />
              <Bar className="h-3.5 w-24" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <InlineError message="Couldn’t load your scans." onRetry={() => refetch()} />
      ) : data && data.items.length > 0 ? (
        <ul className="space-y-2">
          {data.items.map((p) => (
            <li key={p.id}>
              <Link
                to={`/history?open=${p.id}`}
                className="flex h-[60px] items-center gap-3 border border-transparent bg-sheet px-3 transition-colors hover:border-border"
              >
                <img src={p.thumb_url} alt="" className="size-10 flex-none object-cover" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-serif text-[15px] font-semibold">{p.predicted_name}</span>
                  <span className="block truncate text-[12px] text-muted">{when(p.created_at)}</span>
                </span>
                <span className="num text-[13px] text-muted">{percent(p.confidence)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <KnownDishes />
      )}
    </Panel>
  )
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'ready'; photo: Blob; url: string }
  | { kind: 'done'; photo: Blob; url: string; result: PredictResult }

function Result({ result, url, onAgain }: { result: PredictResult; url: string; onAgain: () => void }) {
  const [current, setCurrent] = useState<Prediction>(result)
  const { data: stats } = useStats()
  const { data: dishes } = useDishes()
  const dish = dishes?.find((d) => d.slug === result.predicted_food)
  const threshold = stats?.confidence_threshold ?? 0.6

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <img src={url} alt="Your photo" className="aspect-[4/3] w-full object-cover" />
        <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={onAgain}>
          <RotateCcw className="size-4" aria-hidden="true" /> Scan another dish
        </Button>
      </div>

      <div className="min-w-0">
        {result.is_placeholder && (
          <p className="mb-4 border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3.5 py-2.5 text-[13px] text-[var(--pill-warning-ink)]">
            Demo answer. The model isn’t trained yet, so this guess is made up from the photo’s pixels. It shows how
            results will look.
          </p>
        )}

        {result.is_confident ? (
          <p className="text-[14px] text-muted">This looks like</p>
        ) : (
          <p className="text-[14px] text-muted">Not sure. The closest match is</p>
        )}
        <div className="mt-1 flex items-start gap-4">
          <h2 className="min-w-0 flex-1 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em]">
            {result.predicted_name}
          </h2>
          <p className="num pt-1 text-[30px] leading-tight text-ink">{percent(result.confidence)}</p>
        </div>
        {dish && <p className="mt-1 text-[15px] text-muted">{dish.tagline}</p>}

        <div className="mt-5">
          <ConfidenceMeter value={result.confidence} threshold={threshold} />
        </div>
        {!result.is_confident && (
          <p className="mt-3 text-[14px] text-ink">
            Try another photo: closer, from above, in daylight, with only one dish in the frame.
          </p>
        )}

        <h3 className="mt-7 mb-3 text-[14px] font-semibold">Top three guesses</h3>
        <Candidates items={result.top} />

        <div className="mt-7 border-t border-border pt-5">
          <FeedbackForm prediction={current} onSaved={setCurrent} />
        </div>
      </div>
    </div>
  )
}

function Scanner() {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [camera, setCamera] = useState(false)

  const url = stage.kind === 'idle' ? null : stage.url
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const choose = useCallback(async (file: Blob) => {
    setProblem(null)
    try {
      const photo = await preparePhoto(file)
      setStage({ kind: 'ready', photo, url: URL.createObjectURL(photo) })
    } catch (error) {
      setProblem(error instanceof PhotoProblem ? error.message : 'That photo couldn’t be used.')
    }
  }, [])

  // Paste a photo from the clipboard anywhere on the page.
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) choose(file)
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [choose])

  const recognise = useMutation({
    mutationFn: (photo: Blob) => api.predict(photo),
    onSuccess: (result) => {
      if (stage.kind === 'ready') setStage({ ...stage, kind: 'done', result })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Something went wrong.'
      setProblem(message)
      toast.error(message)
    },
  })

  const reset = () => {
    setStage({ kind: 'idle' })
    setProblem(null)
    recognise.reset()
  }

  return (
    <Panel title={stage.kind === 'done' ? 'Result' : 'Scan a dish'} className="h-full">
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) choose(file)
          event.target.value = ''
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {stage.kind === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const file = event.dataTransfer.files[0]
                if (file) choose(file)
              }}
              className={clsx(
                'grid min-h-[340px] place-items-center border border-dashed px-6 py-10 text-center transition-colors duration-150',
                dragging ? 'border-primary bg-accent-soft/50' : 'border-control bg-sheet',
              )}
            >
              <div className="max-w-sm">
                <p className="font-serif text-[22px] font-semibold leading-snug">Drop a photo of the dish here</p>
                <p className="mt-2 text-[14px] text-muted">
                  JPEG, PNG or WebP, up to {MAX_UPLOAD_MB} MB. You can also paste one.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => input.current?.click()}>
                    <ImageUp className="size-4" aria-hidden="true" /> Choose a photo
                  </Button>
                  <Button variant="secondary" onClick={() => setCamera(true)}>
                    <Camera className="size-4" aria-hidden="true" /> Use camera
                  </Button>
                </div>
              </div>
            </div>
            {problem && (
              <div className="mt-3">
                <InlineError message={problem} />
              </div>
            )}
          </motion.div>
        )}

        {stage.kind === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
          >
            <div className="relative overflow-hidden">
              <img src={stage.url} alt="The photo you chose" className="aspect-[4/3] w-full object-cover" />
              {recognise.isPending && (
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-x-0 h-1/3 bg-[var(--accent)]/25"
                  initial={{ top: '-33%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="font-serif text-[22px] font-semibold">
                {recognise.isPending ? 'Looking at the dish…' : 'Ready to recognise'}
              </p>
              <p className="mt-2 text-[14px] text-muted">
                {recognise.isPending
                  ? 'This takes a moment.'
                  : 'Check that the dish fills most of the photo, then recognise it.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="primary" busy={recognise.isPending} onClick={() => recognise.mutate(stage.photo)}>
                  Recognise dish
                </Button>
                <Button variant="ghost" onClick={reset} disabled={recognise.isPending}>
                  Choose another
                </Button>
              </div>
              {problem && (
                <div className="mt-4">
                  <InlineError message={problem} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {stage.kind === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            <Result result={stage.result} url={stage.url} onAgain={reset} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {camera && (
          <CameraCapture
            onClose={() => setCamera(false)}
            onCapture={(photo) => {
              setCamera(false)
              choose(photo)
            }}
          />
        )}
      </AnimatePresence>
    </Panel>
  )
}

export default function ScanPage() {
  const { data: stats, isLoading } = useStats()
  return (
    <>
      <Greeting stats={stats} />
      <Counts stats={stats} loading={isLoading} />
      {/* 12-column grid, 77px columns, 16px gutters: 9 + 3 shares the line at column 9 with the counts above it. */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <Scanner />
        </div>
        <div className="lg:col-span-3">
          <Recent />
        </div>
      </div>
      {stats && stats.total_scans === 0 && (
        <p className="mt-6 text-[14px] text-muted">
          Not sure what Druk Lens knows? <Link to="/dishes" className="font-medium text-ink underline underline-offset-4">See the nine dishes</Link>.
        </p>
      )}
    </>
  )
}
