const rtfShort = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })
const rtfYear = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' })
const clock = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' })
const dayLong = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' })
const compactFmt = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 })
const fullNum = new Intl.NumberFormat('ru')

/** X-style relative time: "сейчас", "5 мин", "3 ч", "6 фев.", "6 фев. 2024 г." */
export function timeAgo(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'сейчас'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч`
  const d = new Date(ms)
  return d.getFullYear() === new Date().getFullYear() ? rtfShort.format(d) : rtfYear.format(d)
}

export const clockTime = (ms: number) => clock.format(ms)
export const fullDate = (ms: number) => `${clock.format(ms)} · ${rtfYear.format(ms)}`

export function dayLabel(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  const y = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Сегодня'
  if (d.toDateString() === y.toDateString()) return 'Вчера'
  return d.getFullYear() === today.getFullYear() ? dayLong.format(d) : rtfYear.format(d)
}

/** Dialog list time: today → 10:42, this week → Пн, else 6 фев. */
export function listTime(ms: number) {
  const d = new Date(ms)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return clock.format(d)
  if (now.getTime() - ms < 6 * 86_400_000) return d.toLocaleDateString('ru', { weekday: 'short' })
  return timeAgo(ms)
}

export const compact = (n: number | undefined) => (n ? compactFmt.format(n) : '')
const compactInt = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 0 })
/** Engagement counters: one decimal only below 10k ("1,8 тыс.", "26 тыс.", "410 тыс."). */
export const shortCount = (n: number) => (n >= 10_000 ? compactInt.format(n) : compactFmt.format(n))
export const fullNumber = (n: number) => fullNum.format(n)

export function duration(sec = 0) {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function fileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`
  return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`
}

export function pluralRu(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
