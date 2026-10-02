import type { MiddlewareHandler } from 'hono'
import { ApiError } from '../lib/errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Защита от CSRF для cookie-сессий (в дополнение к SameSite=Lax):
 * - изменяющие запросы из браузера принимаются только с Origin фронтенда;
 * - тело принимается только как application/json — такие запросы с чужого
 *   сайта невозможны без CORS-preflight, а CORS мы не разрешаем.
 */
export function csrfGuard(allowedOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next()

    const origin = c.req.header('origin')
    if (origin) {
      if (origin !== allowedOrigin) throw new ApiError(403, 'Запрос с чужого источника отклонён')
    } else {
      const site = c.req.header('sec-fetch-site')
      if (site && site !== 'same-origin' && site !== 'none') {
        throw new ApiError(403, 'Запрос с чужого источника отклонён')
      }
    }

    const hasBody = c.req.raw.body !== null && c.req.header('content-length') !== '0'
    if (hasBody && !c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
      throw new ApiError(415, 'Ожидается тело запроса в формате JSON')
    }
    return next()
  }
}
