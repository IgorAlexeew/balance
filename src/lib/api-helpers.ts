import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

/** Ошибка API с HTTP-статусом и русским сообщением */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Возвращает id пользователя сессии или бросает 401 */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId()
  if (!userId) throw new ApiError(401, 'Требуется авторизация')
  return userId
}

/** Проверяет, что пользователь — участник группы, иначе 403 */
export async function assertGroupAccess(userId: string, groupId: string): Promise<void> {
  const membership = await db.familyMember.findFirst({
    where: { groupId, userId },
  })
  if (!membership) throw new ApiError(403, 'Нет доступа к этой семейной группе')
}

/** Единая обработка ошибок для всех API-роутов */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error('[API ERROR]', e)
  return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** Валидирует параметр month=YYYY-MM, иначе текущий месяц */
export function parseMonthParam(value: string | null): string {
  if (value && MONTH_RE.test(value)) return value
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Границы месяца в UTC для фильтрации дат транзакций (дата хранится как <date>T12:00:00Z) */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  return { start, end }
}

/** Нормализует дату транзакции "YYYY-MM-DD" -> Date (полдень UTC, стабильно для сериализации) */
export function transactionDate(date: string): Date {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(date)
  if (!m) throw new ApiError(400, 'Некорректная дата (ожидается YYYY-MM-DD)')
  return new Date(`${date}T12:00:00.000Z`)
}

/** Парсит ISO-дату или бросает 400 */
export function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ApiError(400, `Некорректное поле: ${field}`)
  }
  const d = new Date(value as string)
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `Некорректная дата: ${field}`)
  return d
}

/** Парсит id из динамического сегмента роута */
export function parseIdParam(value: Record<string, string | string[] | undefined> | undefined, key = 'id'): string {
  const v = value?.[key]
  const id = Array.isArray(v) ? v[0] : v
  if (!id) throw new ApiError(400, 'Не указан идентификатор')
  return id
}

/** Читает строковое поле из body */
export function reqString(body: Record<string, unknown>, field: string, opts?: { max?: number; min?: number }): string {
  const v = body[field]
  if (typeof v !== 'string' || !v.trim()) {
    throw new ApiError(400, `Заполните поле «${field}»`)
  }
  const s = v.trim()
  if (opts?.min && s.length < opts.min) throw new ApiError(400, `Поле «${field}» слишком короткое`)
  if (opts?.max && s.length > opts.max) throw new ApiError(400, `Поле «${field}» слишком длинное (макс. ${opts.max})`)
  return s
}

export function optString(body: Record<string, unknown>, field: string, max = 2000): string | null {
  const v = body[field]
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') throw new ApiError(400, `Некорректное поле: ${field}`)
  return v.trim().slice(0, max) || null
}

export function numField(body: Record<string, unknown>, field: string, min: number, max: number): number {
  const v = body[field]
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
    throw new ApiError(400, `Поле «${field}» должно быть числом от ${min} до ${max}`)
  }
  return n
}
