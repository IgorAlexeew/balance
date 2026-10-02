import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { Prisma } from '@prisma/client'

/** Ошибка API с HTTP-статусом и сообщением для пользователя */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message)
  }
}

export const badRequest = (message: string) => new ApiError(400, message)
export const forbidden = (message = 'Недостаточно прав') => new ApiError(403, message)
export const notFound = (message = 'Не найдено') => new ApiError(404, message)

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({ error: err.message }, err.status)
  }
  if (err instanceof HTTPException) {
    const message = err.status === 400 ? 'Некорректный запрос' : err.message
    return c.json({ error: message }, err.status)
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return c.json({ error: 'Такая запись уже существует' }, 409)
    if (err.code === 'P2025') return c.json({ error: 'Запись не найдена' }, 404)
  }
  console.error('[api] unhandled error', err)
  return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
}
