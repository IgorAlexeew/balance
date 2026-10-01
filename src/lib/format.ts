import { format, isToday, isTomorrow, isYesterday, parseISO, formatDistanceToNowStrict } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ReminderDTO, ReminderType, TaskDTO, TaskPriority } from '@/lib/types'

// ===== Деньги =====

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})
const rubFormatterKop = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function fmtMoney(amount: number): string {
  return Number.isInteger(amount) ? rubFormatter.format(amount) : rubFormatterKop.format(amount)
}

export function fmtMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} млн ₽`
  if (Math.abs(amount) >= 10_000) return `${Math.round(amount / 1000)} тыс. ₽`
  return `${Math.round(amount)} ₽`
}

// ===== Даты =====

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'd MMM', { locale: ru })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'd MMM, HH:mm', { locale: ru })
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'HH:mm')
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

export function relativeDaysFromNow(iso: string): string {
  return formatDistanceToNowStrict(parseISO(iso), { locale: ru, addSuffix: true })
}

export function isOverdueTask(task: TaskDTO): boolean {
  return task.status === 'todo' && !!task.deadline && parseISO(task.deadline).getTime() < Date.now()
}

/** Заголовок месяца «Январь 2026» */
export function monthTitle(month: string): string {
  const d = parseISO(`${month}-01T12:00:00`)
  return format(d, 'LLLL yyyy', { locale: ru })
}

/** Текущий месяц в формате YYYY-MM (локально) */
export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const d = parseISO(`${month}-01T12:00:00`)
  d.setMonth(d.getMonth() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ===== Задачи =====

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
}

export const PRIORITY_CHIP_CLASSES: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export const PRIORITY_DOT_CLASSES: Record<TaskPriority, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  urgent: 'bg-rose-500',
}

// ===== Напоминания =====

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  at_deadline: 'В момент срока',
  before: 'Заранее до срока',
  daily: 'Каждый день',
  morning: 'Каждое утро',
  weekly: 'По дням недели',
  once: 'Один раз',
}

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function humanizeOffset(minutes: number): string {
  if (minutes % 1440 === 0 && minutes >= 1440) {
    const days = minutes / 1440
    return `за ${days} ${plural(days, 'день', 'дня', 'дней')}`
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60
    return `за ${hours} ${plural(hours, 'час', 'часа', 'часов')}`
  }
  return `за ${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** Человекочитаемое описание напоминания */
export function humanizeReminder(r: ReminderDTO | null): string {
  if (!r) return 'Без напоминания'
  switch (r.type) {
    case 'at_deadline':
      return 'В момент срока'
    case 'before':
      return r.offsetMinutes ? `${humanizeOffset(r.offsetMinutes)} до срока` : 'Заранее до срока'
    case 'daily':
      return `Каждый день в ${r.time ?? '09:00'}`
    case 'morning':
      return `Каждое утро в ${r.time ?? '09:00'}`
    case 'weekly': {
      const days = (r.daysOfWeek ?? '')
        .split(',')
        .filter(Boolean)
        .map((d) => WEEKDAY_LABELS[Number(d) - 1] ?? '')
        .filter(Boolean)
      return days.length ? `По ${days.join(', ')} в ${r.time ?? '09:00'}` : `Еженедельно в ${r.time ?? '09:00'}`
    }
    case 'once':
      return r.fireAt ? `Один раз — ${fmtDateTime(r.fireAt)}` : 'Один раз'
    default:
      return 'Напоминание'
  }
}

// ===== Прочее =====

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export function todayTitle(): string {
  return format(new Date(), 'EEEE, d MMMM', { locale: ru })
}
