import { z } from 'zod'

export const idSchema = z.string().trim().min(1, 'Не указан идентификатор').max(64)

/** Момент времени в ISO 8601 (с Z или смещением) */
export const isoDateTimeSchema = z.iso.datetime({ offset: true, error: 'Некорректная дата и время' })

/** Календарная дата YYYY-MM-DD */
export const localDateSchema = z.iso.date({ error: 'Некорректная дата (ожидается ГГГГ-ММ-ДД)' })

/** Месяц YYYY-MM */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Некорректный месяц (ожидается ГГГГ-ММ)')

/** Время суток HH:MM */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Укажите время в формате ЧЧ:ММ')

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, 'Неизвестный часовой пояс')

/**
 * Необязательный текст: undefined — поле не передано, '' или null — очистить.
 * Пустые строки после trim превращаются в null.
 */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Слишком длинный текст (макс. ${max})`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null))
}

export function requiredText(max: number, field: string) {
  return z
    .string({ error: `Заполните поле «${field}»` })
    .trim()
    .min(1, `Заполните поле «${field}»`)
    .max(max, `Поле «${field}» слишком длинное (макс. ${max})`)
}

/** Ссылка на группу: null/'' — личные данные */
export const groupRefSchema = idSchema
  .nullish()
  .or(z.literal(''))
  .transform((v) => (v === undefined ? undefined : v || null))

/** Тело ошибки любого эндпоинта API */
export interface ApiErrorBody {
  error: string
}

/** Деньги передаются и хранятся в копейках (целое число) */
export type Kopecks = number
