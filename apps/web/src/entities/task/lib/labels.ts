import type { ReminderDTO, ReminderType, TaskDTO, TaskPriority } from '@balance/contracts'
import { fmtDateTime, plural, WEEKDAY_SHORT } from '@/shared/lib/format'

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

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  at_deadline: 'В момент срока',
  before: 'Заранее до срока',
  daily: 'Каждый день в…',
  morning: 'Каждое утро в…',
  weekly: 'По дням недели',
  once: 'Один раз',
}

/** «1 день» / «2 часа» / «45 минут» */
export function describeOffset(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440
    return `${days} ${plural(days, 'день', 'дня', 'дней')}`
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} ${plural(hours, 'час', 'часа', 'часов')}`
  }
  return `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')}`
}

export function describeWeekdays(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d - 1] ?? '')
    .filter(Boolean)
    .join(', ')
}

export function humanizeReminder(r: ReminderDTO | null): string {
  if (!r) return 'Без напоминания'
  switch (r.type) {
    case 'at_deadline':
      return 'В момент срока'
    case 'before':
      return r.offsetMinutes ? `За ${describeOffset(r.offsetMinutes)} до срока` : 'Заранее до срока'
    case 'daily':
      return `Каждый день в ${r.time ?? '—'}`
    case 'morning':
      return `Каждое утро в ${r.time ?? '—'}`
    case 'weekly':
      return r.daysOfWeek.length ? `По ${describeWeekdays(r.daysOfWeek)} в ${r.time ?? '—'}` : 'Еженедельно'
    case 'once':
      return r.fireAt ? `Один раз — ${fmtDateTime(r.fireAt)}` : 'Один раз'
  }
}

export function isOverdueTask(task: Pick<TaskDTO, 'status' | 'deadline'>, now = Date.now()): boolean {
  return task.status === 'todo' && !!task.deadline && Date.parse(task.deadline) < now
}
