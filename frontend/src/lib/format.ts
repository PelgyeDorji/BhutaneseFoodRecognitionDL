export const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const fullFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "Today, 14:05", "Yesterday, 09:12", "3 Oct, 18:40". */
export function when(iso: string) {
  const date = new Date(iso)
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : dayFormat.format(date)
  return `${day}, ${timeFormat.format(date)}`
}

export const shortDay = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00`))
export const today = () => fullFormat.format(new Date())

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`
