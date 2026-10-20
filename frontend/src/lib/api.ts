import type {
  AdminScan,
  AdminSummary,
  AdminUser,
  Answer,
  Dish,
  History,
  PredictResult,
  Prediction,
  Session,
  Stats,
  User,
} from './types'

export class ApiError extends Error {
  status: number
  fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string }

function readError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return new ApiError(status, detail)
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {}
    for (const item of detail as ValidationItem[]) {
      const field = String(item.loc?.[item.loc.length - 1] ?? 'form')
      const msg = (item.msg ?? 'Invalid value').replace(/^Value error, /, '')
      fields[field] = msg.startsWith('value is not a valid email') ? 'Enter a valid email address.' : msg
    }
    return new ApiError(status, Object.values(fields)[0] ?? 'Check the form.', fields)
  }
  if (status === 0) return new ApiError(0, "Can't reach the server. Is the backend running?")
  return new ApiError(status, 'Something went wrong. Please try again.')
}

/** Every call goes through here: same-origin cookie, and the header the API's CSRF check wants. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Requested-With', 'fetch')
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw readError(0, null)
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('auth:expired'))
    throw readError(response.status, body)
  }
  return body as T
}

const json = (body: unknown) => JSON.stringify(body)

export const api = {
  me: () => request<User>('/users/me'),
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<Session>('/auth/register', { method: 'POST', body: json({ name, email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  updateProfile: (name: string) => request<User>('/users/me', { method: 'PATCH', body: json({ name }) }),
  changePassword: (current_password: string, new_password: string) =>
    request<Session>('/users/me/password', {
      method: 'POST',
      body: json({ current_password, new_password }),
    }),

  predict: (file: Blob, filename = 'photo.jpg') => {
    const form = new FormData()
    form.append('file', file, filename)
    return request<PredictResult>('/predict', { method: 'POST', body: form })
  },
  history: (params: { limit?: number; offset?: number; dish?: string; answer?: 'none' | 'correct' | 'wrong' } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))
    if (params.dish) query.set('dish', params.dish)
    if (params.answer) query.set('answer', params.answer)
    const suffix = query.size ? `?${query}` : ''
    return request<History>(`/history${suffix}`)
  },
  deletePrediction: (id: number) => request<void>(`/history/${id}`, { method: 'DELETE' }),
  feedback: (body: {
    prediction_id: number
    is_correct: boolean
    correct_food?: string | null
    comment?: string | null
  }) => request<Prediction>('/feedback', { method: 'POST', body: json(body) }),

  stats: () => request<Stats>(`/stats?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`),
  dishes: () => request<Dish[]>('/dishes'),

  admin: {
    summary: () => request<AdminSummary>('/admin/summary'),
    users: (params: { q?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: AdminUser[]; total: number }>(`/admin/users${toQuery(params)}`),
    scans: (params: { limit?: number; offset?: number; user_id?: number; dish?: string; answer?: Answer } = {}) =>
      request<{ items: AdminScan[]; total: number }>(`/admin/scans${toQuery(params)}`),
    feedbackCsvUrl: '/api/admin/feedback.csv',
  },
}

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 0) query.set(key, String(value))
  }
  return query.size ? `?${query}` : ''
}
