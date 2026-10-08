import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { ReminderType } from '@balance/contracts'

export interface ReminderRule {
  type: ReminderType | string
  time: string | null
  /** "1,3,5" — 1 = Пн … 7 = Вс */
  daysOfWeek: string | null
  offsetMinutes: number | null
  fireAt: Date | null
}

export interface ScheduleContext {
  deadline: Date | null
  /** IANA-зона получателя напоминания */
  timezone: string
  /** Ищем срабатывание строго позже этого момента */
  after: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

export function parseDaysOfWeek(value: string | null): number[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
}

/**
 * Следующий момент срабатывания напоминания или null, если оно больше не сработает.
 * Ежедневные и еженедельные напоминания считаются по настенным часам в зоне
 * получателя, поэтому переходы на летнее/зимнее время учитываются корректно.
 */
export function computeNextFireAt(rule: ReminderRule, ctx: ScheduleContext): Date | null {
  const after = ctx.after.getTime()
  const future = (d: Date | null) => (d && d.getTime() > after ? d : null)

  switch (rule.type) {
    case 'at_deadline':
      return future(ctx.deadline)
    case 'before':
      if (!ctx.deadline || rule.offsetMinutes == null) return null
      return future(new Date(ctx.deadline.getTime() - rule.offsetMinutes * 60_000))
    case 'once':
      return future(rule.fireAt)
    case 'daily':
    case 'morning':
      return nextWallClockOccurrence(rule.time, null, ctx)
    case 'weekly': {
      const days = parseDaysOfWeek(rule.daysOfWeek)
      return days.length ? nextWallClockOccurrence(rule.time, days, ctx) : null
    }
    default:
      return null
  }
}

function nextWallClockOccurrence(
  time: string | null,
  days: number[] | null,
  ctx: ScheduleContext,
): Date | null {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  // Сегодняшняя дата по часам получателя
  const [y, m, d] = formatInTimeZone(ctx.after, ctx.timezone, 'yyyy-MM-dd').split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const todayUtc = Date.UTC(y, m - 1, d)
  // 8 дней хватает, чтобы найти ближайший подходящий день недели
  for (let offset = 0; offset <= 8; offset++) {
    const day = new Date(todayUtc + offset * DAY_MS)
    const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay()
    if (days && !days.includes(isoWeekday)) continue
    const wall = `${day.toISOString().slice(0, 10)}T${time}:00`
    const instant = fromZonedTime(wall, ctx.timezone)
    if (instant.getTime() > ctx.after.getTime()) return instant
  }
  return null
}
