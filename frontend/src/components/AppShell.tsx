import clsx from 'clsx'
import {
  BookOpen,
  Camera,
  ChartColumn,
  History,
  Images,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Mark, Wordmark } from './Brand'
import { KiraBand } from './KiraBand'

const NAV = [
  { to: '/', label: 'Scan a dish', icon: Camera, end: true },
  { to: '/history', label: 'History', icon: History },
  { to: '/insights', label: 'Insights', icon: ChartColumn },
  { to: '/dishes', label: 'Dishes', icon: BookOpen },
]

const ADMIN_NAV = [
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/scans', label: 'All scans', icon: Images, end: false },
  { to: '/admin/feedback', label: 'All feedback', icon: MessageSquareText, end: false },
]

const ALL_NAV = [...NAV, ...ADMIN_NAV]

/** The main links, plus the admin group for admins. */
function MainNav() {
  const { user } = useAuth()
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavItem key={item.to} {...item} />
      ))}
      {user?.is_admin && (
        <>
          <p className="mt-6 mb-1 px-3 text-[12px] text-muted">Admin</p>
          {ADMIN_NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </>
      )}
    </nav>
  )
}

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors duration-150',
          isActive ? 'bg-active font-medium text-ink' : 'text-muted hover:bg-active/60 hover:text-ink',
        )
      }
    >
      <Icon className="size-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </NavLink>
  )
}

function Initial({ name }: { name: string }) {
  return (
    <span className="grid size-8 flex-none place-items-center rounded-full bg-accent-soft font-serif text-[14px] font-semibold text-accent-ink">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

function Account({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <div className="space-y-1">
      <NavItem to="/settings" label="Settings" icon={Settings} />
      <div className="flex items-center gap-3 rounded-[10px] px-3 py-2.5">
        <Initial name={user.name} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-medium text-ink">{user.name}</p>
          <p className="truncate text-[12px] text-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            onNavigate?.()
            await signOut()
            navigate('/login', { replace: true })
          }}
          className="grid size-8 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-active hover:text-ink"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] flex-none flex-col px-3 pb-3 pt-6 lg:flex">
      <div className="px-3">
        <Wordmark />
      </div>
      <div className="mt-8">
        <MainNav />
      </div>
      <div className="mt-auto">
        <Account />
      </div>
    </aside>
  )
}

function PhoneBar({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const current = ALL_NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', close)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', close)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-chrome px-4 lg:hidden">
        <Mark size={26} />
        <span className="flex-1 truncate font-serif text-[18px] font-semibold">
          {location.pathname === '/settings' ? 'Settings' : (current?.label ?? 'Druk Lens')}
        </span>
        {children}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-active"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col bg-sheet px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex h-11 items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 place-items-center rounded-full hover:bg-active"
                aria-label="Close menu"
              >
                <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 overflow-y-auto text-[16px]">
              <MainNav />
            </div>
            <div className="mt-auto">
              <Account onNavigate={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Tinted frame, white sheet: the sidebar sits on the stone-coloured chrome and the
 * page lives on a sheet inset 8px from the window's right and bottom edges.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-chrome">
      <KiraBand height={6} className="fixed inset-x-0 top-0 z-50" />
      <div className="flex pt-[6px]">
        <Sidebar />
        <div className="min-w-0 flex-1 lg:py-2 lg:pr-2">
          <PhoneBar />
          <main className="min-h-[calc(100dvh-6px)] bg-sheet lg:min-h-[calc(100dvh-22px)] lg:rounded-2xl lg:border lg:border-border">
            <div className="mx-auto w-full max-w-[1132px] px-4 pb-16 pt-6 sm:px-6 lg:px-4 lg:pt-14">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
