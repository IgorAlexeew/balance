import { z } from 'zod'
import { isoDateTimeSchema, timeOfDaySchema } from './common'
import type { ReminderType } from './enums'

export const MAX_REMINDER_OFFSET_MINUTES = 30 * 24 * 60

export const reminderInputSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ type: z.literal('at_deadline') }),
    z.object({
      type: z.literal('before'),
      offsetMinutes: z
        .number()
        .int()
        .min(1, 'Минимум — за 1 минуту')
        .max(MAX_REMINDER_OFFSET_MINUTES, 'Максимум — за 30 дней'),
    }),
    z.object({ type: z.literal('daily'), time: timeOfDaySchema }),
    z.object({ type: z.literal('morning'), time: timeOfDaySchema }),
    z.object({
      type: z.literal('weekly'),
      time: timeOfDaySchema,
      daysOfWeek: z
        .array(z.number().int().min(1).max(7))
        .min(1, 'Выберите дни недели')
        .max(7)
        .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    }),
    z.object({ type: z.literal('once'), fireAt: isoDateTimeSchema }),
  ],
  { error: 'Выберите тип напоминания' },
)

export type ReminderInput = z.input<typeof reminderInputSchema>

export interface ReminderDTO {
  type: ReminderType
  /** HH:MM — для daily/morning/weekly, в часовом поясе получателя */
  time: string | null
  /** 1 = Пн … 7 = Вс — для weekly */
  daysOfWeek: number[]
  offsetMinutes: number | null
  fireAt: string | null
  /** Когда напоминание сработает в следующий раз (null — больше не сработает) */
  nextFireAt: string | null
}
