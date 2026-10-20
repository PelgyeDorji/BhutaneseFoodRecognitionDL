import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border border-control hover:bg-raised',
  ghost: 'text-ink hover:bg-active',
  danger: 'bg-surface text-negative border border-control hover:bg-[var(--pill-negative-bg)]',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  busy?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', busy, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || busy}
      className={clsx(
        'inline-flex flex-none select-none items-center justify-center gap-2 whitespace-nowrap font-medium',
        'transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
        'disabled:active:scale-100',
        size === 'sm' && 'h-8 px-3.5 text-[13px]',
        size === 'md' && 'h-10 px-4.5 text-[14px]',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        // Disabled reads as plain grey; a busy button keeps its colour so the spinner sits on it.
        disabled && !busy ? 'bg-active text-faint' : variants[variant],
        busy && 'opacity-80',
        className,
      )}
      {...props}
    >
      {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

const fieldClass =
  'block w-full border border-control bg-surface px-3.5 text-ink placeholder:text-faint ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-faint focus:border-[var(--focus)] focus:outline-none ' +
  'focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_22%,transparent)] ' +
  'aria-[invalid=true]:border-negative'

type FieldShell = { label: string; error?: string; hint?: ReactNode; className?: string }

function Shell({ id, label, error, hint, className, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[14px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[13px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const TextField = forwardRef<HTMLInputElement, FieldShell & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, className, id, ...props }, ref) {
    const autoId = useId()
    const fieldId = id ?? autoId
    return (
      <Shell id={fieldId} label={label} error={error} hint={hint} className={className}>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          className={clsx(fieldClass, 'h-11')}
          {...props}
        />
      </Shell>
    )
  },
)

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <select id={id} aria-invalid={error ? true : undefined} className={clsx(fieldClass, 'h-10 pr-8')} {...props}>
        {children}
      </select>
    </Shell>
  )
}

export function TextAreaField({
  label,
  error,
  hint,
  className,
  ...props
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea id={id} aria-invalid={error ? true : undefined} className={clsx(fieldClass, 'min-h-20 py-2')} {...props} />
    </Shell>
  )
}

/** A tonal panel: one step off the sheet, no border, no shadow. */
export function Panel({
  title,
  action,
  children,
  className,
  as: Tag = 'section',
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  as?: 'section' | 'div'
}) {
  return (
    <Tag className={clsx(' bg-raised p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex min-h-6 items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  )
}

type Tone = 'positive' | 'negative' | 'warning' | 'neutral'

const tones: Record<Tone, string> = {
  positive: 'bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]',
  negative: 'bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]',
  warning: 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]',
  neutral: 'bg-active text-muted',
}

export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap px-2.5 text-[12px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A flat grey bar at the size of the value it stands in for. No shimmer. */
export function Bar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={clsx('block bg-active', className)} />
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted" role="alert">
      <span className="size-2 flex-none bg-negative" aria-hidden="true" />
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium text-ink underline underline-offset-4">
          Try again
        </button>
      )}
    </p>
  )
}

export function PageTitle({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-[32px]">
          {title}
        </h1>
        {sub && <p className="mt-1.5 text-[15px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}
