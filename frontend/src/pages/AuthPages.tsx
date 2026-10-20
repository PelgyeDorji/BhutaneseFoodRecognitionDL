import { motion } from 'motion/react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Mark, Wordmark } from '../components/Brand'
import { KiraBand } from '../components/KiraBand'
import { Button, TextField } from '../components/ui'
import { ApiError } from '../lib/api'
import { useDishes } from '../lib/queries'

/**
 * The brand field: monastic maroon in both themes, the nine dishes set as type,
 * the kira weave along its foot. No pictures.
 */
function BrandField({ statement }: { statement: string }) {
  const { data: dishes = [] } = useDishes()
  return (
    <div className="relative hidden flex-col overflow-hidden bg-[#6e1a26] text-[#f6efe3] lg:flex">
      <div className="flex flex-1 flex-col px-12 pb-10 pt-10 xl:px-16">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-serif text-[19px] font-semibold tracking-[-0.01em]">Druk Lens</span>
        </div>

        <div className="my-auto max-w-[520px] py-12">
          <p className="text-balance font-serif text-[36px] font-semibold leading-[1.1] tracking-[-0.02em]">{statement}</p>
          <p className="mt-4 max-w-[420px] text-[16px] leading-relaxed text-[#f6efe3]/75">
            A deep learning project that names Bhutanese dishes from a single photo, and learns from your answers.
          </p>

          {dishes.length > 0 && (
            <div className="mt-12">
              <p className="text-[13px] text-[#f6efe3]/60">Learning to recognise</p>
              <ul className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2.5">
                {dishes.map((dish) => (
                  <li key={dish.slug} className="font-serif text-[17px] font-medium leading-snug">
                    {dish.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-[13px] text-[#f6efe3]/60">
          CSA301 Deep Learning · Gyalpozhing College of Information Technology
        </p>
      </div>
      <KiraBand height={18} />
    </div>
  )
}

function Layout({ statement, children }: { statement: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-sheet lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandField statement={statement} />

      <div className="flex flex-col">
        <KiraBand height={8} className="lg:hidden" />
        <div className="px-5 pt-6 sm:px-10 lg:hidden">
          <Wordmark to="/login" />
        </div>
        <motion.div
          className="mx-auto my-auto w-full max-w-[400px] px-5 py-14 sm:px-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Something went wrong. Please try again.'))
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, submit } = useSubmit(async () => {
    await signIn(email, password)
    navigate(from, { replace: true })
  })

  return (
    <Layout statement="Name the dish on the plate.">
      <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-[-0.015em]">Sign in</h1>
      <p className="mt-2 text-[15px] text-muted">Photograph a Bhutanese dish and find out what it is.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.fields.email}
          required
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.fields.password}
          required
        />
        {error && !error.fields.email && !error.fields.password && (
          <p className="text-[14px] text-negative" role="alert">
            {error.message}
          </p>
        )}
        <Button variant="primary" size="lg" type="submit" busy={busy} disabled={!email || !password} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-[14px] text-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </Layout>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, submit } = useSubmit(async () => {
    await register(name, email, password)
    navigate('/', { replace: true })
  })

  return (
    <Layout statement="Keep a record of every plate.">
      <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-[-0.015em]">Create an account</h1>
      <p className="mt-2 text-[15px] text-muted">Your scans and answers are kept in your own history.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <TextField label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={error?.fields.name} maxLength={80} required autoFocus />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.fields.email}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.fields.password}
          hint="At least 8 characters. A short phrase is easier to remember."
          required
        />
        {error && Object.keys(error.fields).length === 0 && (
          <p className="text-[14px] text-negative" role="alert">
            {error.message}
          </p>
        )}
        <Button variant="primary" size="lg" type="submit" busy={busy} disabled={!name || !email || password.length < 8} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-[14px] text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </Layout>
  )
}
