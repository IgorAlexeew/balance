import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import { ApiError } from './errors'

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Простой лимит запросов в памяти процесса (фиксированное окно) по пользователю.
 * Для одного инстанса API этого достаточно; при масштабировании — вынести в Redis.
 */
export function rateLimit(opts: { name: string; limit: number; windowMs: number; message: string }) {
  const buckets = new Map<string, Bucket>()
  const middleware: MiddlewareHandler<AppEnv> = async (c, next) => {
    const now = Date.now()
    const key = c.get('user').id
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    if (bucket.count > opts.limit) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      throw new ApiError(429, opts.message)
    }
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    }
    await next()
  }
  return middleware
}
