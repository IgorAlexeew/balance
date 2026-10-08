import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

// ===== Деньги (все суммы в API — целые копейки) =====

const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const rubWithKopecks = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(kopecks: number): string {
  return kopecks % 100 === 0 ? rub.format(kopecks / 100) : rubWithKopecks.format(kopecks / 100)
}

export function formatMoneyShort(kopecks: number): string {
  const rubles = kopecks / 100
  if (Math.abs(rubles) >= 1_000_000) return `${(rubles / 1_000_000).toFixed(1).replace('.0', '')} млн ₽`
  if (Math.abs(rubles) >= 10_000) return `${Math.round(rubles / 1000)} тыс. ₽`
  return `${Math.round(rubles)} ₽`
}

/** «1 234,5» → 123450 копеек; null — если это не положительная сумма */
export function parseRublesToKopecks(input: string): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const kopecks = Math.round(Number(normalized) * 100)
  return kopecks > 0 ? kopecks : null
}

export function kopecksToInput(kopecks: number): string {
  return kopecks % 100 === 0 ? String(kopecks / 100) : (kopecks / 100).toFixed(2)
}

// ===== Даты =====

export function fmtDate(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), 'd MMM', { locale: ru }) : '—'
}

export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), 'd MMM, HH:mm', { locale: ru }) : '—'
}

export function fmtTime(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), 'HH:mm') : '—'
}

export function fmtDayMonth(iso: string): string {
  return format(parseISO(iso), 'd MMMM', { locale: ru })
}

/** Сегодня / Завтра / Вчера / дата */
export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = parseISO(iso)
  if (isToday(d)) return 'Сегодня'
  if (isTomorrow(d)) return 'Завтра'
  if (isYesterday(d)) return 'Вчера'
  return format(d, 'd MMM', { locale: ru })
}

export function relativeFromNow(iso: string): string {
  return formatDistanceToNowStrict(parseISO(iso), { locale: ru, addSuffix: true })
}

/** ISO → значение для <input type="datetime-local"> в локальной зоне */
export function isoToLocalInput(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

export function todayLocalDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// ===== Месяцы (YYYY-MM) =====

export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function shiftMonth(month: string, delta: number): string {
  const d = parseISO(`${month}-01T12:00:00`)
  d.setMonth(d.getMonth() + delta)
  return format(d, 'yyyy-MM')
}

/** «Октябрь 2026» */
export function monthTitle(month: string): string {
  const title = format(parseISO(`${month}-01T12:00:00`), 'LLLL yyyy', { locale: ru })
  return title.charAt(0).toUpperCase() + title.slice(1)
}

// ===== Текст =====

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export function todayTitle(): string {
  return format(new Date(), 'EEEE, d MMMM', { locale: ru })
}

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const
export const WEEKDAY_FULL = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
] as const
