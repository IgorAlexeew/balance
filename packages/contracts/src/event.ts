import { z } from 'zod'
import { groupRefSchema, isoDateTimeSchema, optionalText, requiredText } from './common.js'
import { EVENT_COLORS, type EventColor } from './enums.js'

const eventFields = {
  title: requiredText(200, 'Название'),
  description: optionalText(2000),
  start: isoDateTimeSchema,
  end: isoDateTimeSchema,
  allDay: z.boolean(),
  color: z.enum(EVENT_COLORS, { error: 'Некорректный цвет' }),
}

const endAfterStart = (v: { start?: string; end?: string }) =>
  !v.start || !v.end || Date.parse(v.end) > Date.parse(v.start)
const endAfterStartError = { message: 'Окончание должно быть позже начала', path: ['end'] }

export const eventCreateSchema = z
  .object({
    ...eventFields,
    allDay: eventFields.allDay.default(false),
    color: eventFields.color.default('emerald'),
    groupId: groupRefSchema,
  })
  .refine(endAfterStart, endAfterStartError)
export type EventCreateInput = z.input<typeof eventCreateSchema>

export const eventUpdateSchema = z
  .object({
    title: eventFields.title.optional(),
    description: eventFields.description,
    start: eventFields.start.optional(),
    end: eventFields.end.optional(),
    allDay: eventFields.allDay.optional(),
    color: eventFields.color.optional(),
  })
  .refine(endAfterStart, endAfterStartError)
export type EventUpdateInput = z.input<typeof eventUpdateSchema>

export const eventListQuerySchema = z
  .object({
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
    groupId: groupRefSchema,
  })
  .refine((v) => Date.parse(v.to) > Date.parse(v.from), { message: 'Некорректный диапазон дат' })
  .refine((v) => Date.parse(v.to) - Date.parse(v.from) <= 400 * 24 * 3600 * 1000, {
    message: 'Слишком большой диапазон дат',
  })
export type EventListQuery = z.input<typeof eventListQuerySchema>

export interface CalendarEventDTO {
  id: string
  title: string
  description: string | null
  start: string
  end: string
  allDay: boolean
  color: EventColor
  userId: string
  userName: string | null
  groupId: string | null
  createdAt: string
}
