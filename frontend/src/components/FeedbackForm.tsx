import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { api, ApiError } from '../lib/api'
import { useDishes } from '../lib/queries'
import type { Prediction } from '../lib/types'
import { Button, Pill, TextAreaField } from './ui'

type Props = { prediction: Prediction; onSaved?: (prediction: Prediction) => void }

export function FeedbackStatus({ prediction }: { prediction: Prediction }) {
  const { data: dishes } = useDishes()
  const feedback = prediction.feedback
  if (!feedback) return <Pill>Not checked</Pill>
  if (feedback.is_correct) return <Pill tone="positive">Correct</Pill>
  const actual = dishes?.find((d) => d.slug === feedback.correct_food)?.name ?? feedback.correct_food
  return <Pill tone="negative">Was {actual}</Pill>
}

/** "Is this right?" Yes saves at once; No asks which dish it really was. */
export function FeedbackForm({ prediction, onSaved }: Props) {
  const queryClient = useQueryClient()
  const { data: dishes = [] } = useDishes()
  const [editing, setEditing] = useState(!prediction.feedback)
  const [wrong, setWrong] = useState(prediction.feedback ? !prediction.feedback.is_correct : false)
  const [actual, setActual] = useState<string | null>(prediction.feedback?.correct_food ?? null)
  const [comment, setComment] = useState(prediction.feedback?.comment ?? '')

  const save = useMutation({
    mutationFn: (isCorrect: boolean) =>
      api.feedback({
        prediction_id: prediction.id,
        is_correct: isCorrect,
        correct_food: isCorrect ? null : actual,
        comment: comment.trim() || null,
      }),
    onSuccess: (updated) => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      onSaved?.(updated)
      toast.success('Thanks. Your answer is saved.')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save that.'),
  })

  if (!editing && prediction.feedback) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <FeedbackStatus prediction={prediction} />
        {prediction.feedback.comment && (
          <span className="min-w-0 truncate text-[14px] text-muted">“{prediction.feedback.comment}”</span>
        )}
        <button
          type="button"
          className="ml-auto text-[14px] font-medium text-ink underline-offset-4 hover:underline"
          onClick={() => setEditing(true)}
        >
          Change answer
        </button>
      </div>
    )
  }

  const choices = dishes.filter((d) => d.slug !== prediction.predicted_food)

  return (
    <div>
      <p className="text-[15px] font-medium text-ink">Is it {prediction.predicted_name}?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setWrong(false)
            save.mutate(true)
          }}
          busy={save.isPending && !wrong}
          disabled={save.isPending}
        >
          <Check className="size-4" aria-hidden="true" /> Yes, correct
        </Button>
        <Button
          variant={wrong ? 'primary' : 'secondary'}
          onClick={() => setWrong(true)}
          disabled={save.isPending}
          aria-expanded={wrong}
        >
          <X className="size-4" aria-hidden="true" /> No, it’s something else
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {wrong && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <fieldset className="pt-5">
              <legend className="mb-3 text-[14px] font-medium text-ink">Which dish is it?</legend>
              <div className="flex flex-wrap gap-2">
                {choices.map((dish) => (
                  <button
                    key={dish.slug}
                    type="button"
                    onClick={() => setActual(dish.slug)}
                    aria-pressed={actual === dish.slug}
                    className={clsx(
                      'h-9 rounded-full border px-3.5 text-[14px] transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]',
                      actual === dish.slug
                        ? 'border-ink bg-ink text-sheet'
                        : 'border-control bg-surface text-ink hover:bg-raised',
                    )}
                  >
                    {dish.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <TextAreaField
              className="mt-4"
              label="Anything else? (optional)"
              placeholder="For example: it was dark, or only half the plate was in the photo"
              maxLength={500}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => save.mutate(false)} busy={save.isPending} disabled={!actual}>
                Save answer
              </Button>
              {prediction.feedback && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
