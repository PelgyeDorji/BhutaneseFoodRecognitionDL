import { useQuery } from '@tanstack/react-query'

import { api } from './api'

export function useDishes() {
  return useQuery({ queryKey: ['dishes'], queryFn: api.dishes, staleTime: Infinity })
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: api.stats })
}

export function useRecent(limit = 5) {
  return useQuery({ queryKey: ['history', { limit }], queryFn: () => api.history({ limit }) })
}
