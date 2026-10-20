import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '../auth/AuthContext'
import { Button, PageTitle, TextField } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useTheme, type ThemeChoice } from '../lib/theme'

/** One settings section: a label column beside a tonal panel. */
function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border py-8 first:border-t-0 first:pt-0 lg:grid-cols-12 lg:gap-4">
      <div className="lg:col-span-5 lg:pt-2">
        <h2 className="text-[16px] font-medium">{title}</h2>
        <div className="mt-1 text-[14px] text-muted">{description}</div>
      </div>
      <div className="rounded-2xl bg-raised p-5 lg:col-span-7">{children}</div>
    </section>
  )
}

function Profile() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [error, setError] = useState<string>()

  const save = useMutation({
    mutationFn: () => api.updateProfile(name),
    onSuccess: (updated) => {
      setUser(updated)
      setError(undefined)
      toast.success('Name saved.')
    },
    onError: (e) => setError(e instanceof ApiError ? (e.fields.name ?? e.message) : 'Could not save.'),
  })

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        save.mutate()
      }}
      className="space-y-4"
    >
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required error={error} autoComplete="name" />
      <TextField label="Email" value={user?.email ?? ''} readOnly disabled hint="Your email is your sign-in and can’t be changed here." />
      <div className="flex justify-end">
        <Button variant="primary" type="submit" busy={save.isPending} disabled={!name.trim() || name.trim() === user?.name}>
          Save name
        </Button>
      </div>
    </form>
  )
}

function Password() {
  const { setUser } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: (session) => {
      setUser(session.user)
      setCurrent('')
      setNext('')
      setErrors({})
      toast.success('Password changed. Other devices have been signed out.')
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.status === 400 ? { current_password: e.message } : e.fields.new_password ? { new_password: e.fields.new_password } : { form: e.message })
      } else setErrors({ form: 'Could not change the password.' })
    },
  })

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        save.mutate()
      }}
      className="space-y-4"
    >
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={errors.current_password}
        required
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.new_password}
        hint="At least 8 characters. A short phrase is easier to remember."
        minLength={8}
        required
      />
      {errors.form && <p className="text-[13px] text-negative">{errors.form}</p>}
      <div className="flex justify-end">
        <Button variant="primary" type="submit" busy={save.isPending} disabled={!current || next.length < 8}>
          Change password
        </Button>
      </div>
    </form>
  )
}

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Monitor },
]

function Appearance() {
  const [theme, setTheme] = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={clsx(
            'flex h-12 items-center gap-2.5 rounded-xl border px-4 text-[14px] transition-[border-color,background-color,transform] duration-150 active:scale-[0.98]',
            theme === value ? 'border-ink bg-surface font-medium' : 'border-border bg-surface/60 text-muted hover:border-control hover:text-ink',
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

function Sessions() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-[14px]">Sign out on this browser and on every other device you’ve used.</p>
      <Button
        variant="danger"
        busy={busy}
        onClick={async () => {
          setBusy(true)
          await signOut()
          navigate('/login', { replace: true })
        }}
      >
        Sign out everywhere
      </Button>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" sub="Your account and how Druk Lens looks on this device." />
      <Section title="Profile" description="The name used in your greeting.">
        <Profile />
      </Section>
      <Section title="Password" description="Changing it signs out your other devices.">
        <Password />
      </Section>
      <Section title="Appearance" description="Saved on this device only.">
        <Appearance />
      </Section>
      <Section title="Sessions" description="Use this if you signed in on a shared computer.">
        <Sessions />
      </Section>
    </>
  )
}
