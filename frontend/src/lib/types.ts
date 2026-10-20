export type User = {
  id: number
  name: string
  email: string
  is_admin: boolean
  created_at: string
}

export type Session = { user: User; expires_in: number }

export type Dish = {
  slug: string
  name: string
  tagline: string
  description: string
  ingredients: string[]
  spice: number
  region: string
  kind: string
}

export type Feedback = {
  is_correct: boolean
  correct_food: string | null
  comment: string | null
  created_at: string
}

export type Prediction = {
  id: number
  predicted_food: string
  predicted_name: string
  confidence: number
  model_used: string
  is_placeholder: boolean
  is_confident: boolean
  image_url: string
  thumb_url: string
  created_at: string
  feedback: Feedback | null
}

export type Guess = { slug: string; name: string; confidence: number }

export type PredictResult = Prediction & { top: Guess[] }

export type History = { items: Prediction[]; total: number }

export type Stats = {
  total_scans: number
  with_feedback: number
  correct: number
  accuracy: number | null
  avg_confidence: number | null
  dishes_seen: number
  top_dishes: { slug: string; name: string; count: number }[]
  mix_ups: { said: string; said_name: string; was: string; was_name: string; count: number }[]
  last_14_days: { day: string; count: number }[]
  confidence_threshold: number
}

export type Answer = 'none' | 'answered' | 'correct' | 'wrong'

export type Owner = { id: number; name: string; email: string }

export type AdminScan = Prediction & { user: Owner }

export type AdminUser = {
  id: number
  name: string
  email: string
  is_admin: boolean
  created_at: string
  scans: number
  answered: number
  correct: number
  last_scan_at: string | null
}

export type AdminSummary = {
  users: number
  scans: number
  answered: number
  correct: number
  accuracy: number | null
  mix_ups: Stats['mix_ups']
}
