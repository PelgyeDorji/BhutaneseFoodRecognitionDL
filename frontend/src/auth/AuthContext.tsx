import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'

import { api, ApiError } from '../lib/api'
import type { User } from '../lib/types'

type AuthState = {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  const setUser = useCallback(
    (user: User | null) => queryClient.setQueryData(['me'], user),
    [queryClient],
  )

  // Forget the previous account's history and stats, but keep the ['me'] query
  // itself: removing it would detach the observer that the route guards read.
  const dropUserData = useCallback(
    () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' }),
    [queryClient],
  )

  useEffect(() => {
    // Any 401 from the API means the session ended (expired, or signed out elsewhere).
    // Only react when someone was signed in; the first "who am I?" check is allowed to 401.
    const expire = () => {
      if (!queryClient.getQueryData(['me'])) return
      dropUserData()
      setUser(null)
    }
    window.addEventListener('auth:expired', expire)
    return () => window.removeEventListener('auth:expired', expire)
  }, [queryClient, setUser, dropUserData])

  const value = useMemo<AuthState>(
    () => ({
      user: data ?? null,
      isLoading,
      setUser,
      signIn: async (email, password) => {
        const session = await api.login(email, password)
        dropUserData()
        setUser(session.user)
      },
      register: async (name, email, password) => {
        const session = await api.register(name, email, password)
        dropUserData()
        setUser(session.user)
      },
      signOut: async () => {
        await api.logout().catch(() => undefined)
        dropUserData()
        setUser(null)
      },
    }),
    [data, isLoading, dropUserData, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
