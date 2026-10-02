import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Response } from 'express'
import { ApiError } from './api-error'

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Требуется авторизация',
  403: 'Недостаточно прав',
  404: 'Не найдено',
  413: 'Слишком большой запрос',
  429: 'Слишком много запросов, попробуйте позже',
}

/** Единый формат ошибок API: { error: string } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api')

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    const [status, message] = this.resolve(exception)
    res.status(status).json({ error: message })
  }

  private resolve(e: unknown): [number, string] {
    if (e instanceof ApiError) return [e.status, e.message]
    if (e instanceof HttpException) {
      const status = e.getStatus()
      return [status, DEFAULT_MESSAGES[status] ?? e.message]
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return [409, 'Такая запись уже существует']
      if (e.code === 'P2025') return [404, 'Запись не найдена']
    }
    this.logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e))
    return [500, 'Внутренняя ошибка сервера']
  }
}
