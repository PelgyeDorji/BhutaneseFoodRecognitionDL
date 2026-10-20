import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import { AppShell } from './components/AppShell'
import { Mark } from './components/Brand'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import ScanPage from './pages/ScanPage'

const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const DishesPage = lazy(() => import('./pages/DishesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminPages').then((m) => ({ default: m.AdminUsersPage })))
const AdminScansPage = lazy(() => import('./pages/AdminPages').then((m) => ({ default: m.AdminScansPage })))
const AdminFeedbackPage = lazy(() => import('./pages/AdminPages').then((m) => ({ default: m.AdminFeedbackPage })))

/** Hides the admin screens from everyone else. The API enforces the same rule on every request. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user?.is_admin) return <NotFound />
  return <Suspense fallback={null}>{children}</Suspense>
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-chrome" aria-busy="true" aria-label="Loading">
      <Mark size={40} />
    </div>
  )
}

function RequireUser({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Splash />
  if (user) return <Navigate to="/" replace />
  return children
}

function NotFound() {
  return (
    <div className="py-10">
      <h1 className="font-serif text-[32px] font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That address doesn’t lead anywhere in Druk Lens.</p>
      <Link to="/" className="mt-6 inline-block font-medium underline underline-offset-4">
        Back to scanning
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route
        element={
          <RequireUser>
            <AppShell />
          </RequireUser>
        }
      >
        <Route index element={<ScanPage />} />
        <Route path="history" element={<Suspense fallback={null}><HistoryPage /></Suspense>} />
        <Route path="insights" element={<Suspense fallback={null}><InsightsPage /></Suspense>} />
        <Route path="dishes" element={<Suspense fallback={null}><DishesPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={null}><SettingsPage /></Suspense>} />
        <Route path="admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="admin/users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="admin/scans" element={<RequireAdmin><AdminScansPage /></RequireAdmin>} />
        <Route path="admin/feedback" element={<RequireAdmin><AdminFeedbackPage /></RequireAdmin>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
