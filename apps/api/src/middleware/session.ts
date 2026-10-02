import type { MiddlewareHandler } from 'hono'
import { ApiError } from '../lib/errors'
import { resolveSession } from '../modules/auth/sessions'
import type { AppEnv } from '../types'

/** Требует авторизованного пользователя, иначе 401 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const resolved = await resolveSession(c, c.get('config'))
  if (!resolved) throw new ApiError(401, 'Требуется авторизация')
  c.set('user', resolved.user)
  c.set('sessionTokenHash', resolved.tokenHash)
  await next()
}
