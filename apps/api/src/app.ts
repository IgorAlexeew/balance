import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { AppConfig } from './config'
import { ApiError, errorHandler } from './lib/errors'
import { csrfGuard } from './middleware/csrf'
import { authRoutes } from './modules/auth/routes'
import { budgetRoutes } from './modules/budget/routes'
import { eventRoutes } from './modules/events/routes'
import { familyRoutes } from './modules/family/routes'
import { meRoutes } from './modules/me/routes'
import { notificationRoutes } from './modules/notifications/routes'
import { taskRoutes } from './modules/tasks/routes'
import { transactionRoutes } from './modules/transactions/routes'
import type { AppEnv } from './types'

export function createApp(config: AppConfig) {
  const api = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('config', config)
      await next()
    })
    .use(csrfGuard(config.appOrigin))
    .use(
      bodyLimit({
        maxSize: 256 * 1024,
        onError: () => {
          throw new ApiError(413, 'Слишком большой запрос')
        },
      }),
    )
    .get('/health', (c) => c.json({ ok: true }))
    .route('/', authRoutes)
    .route('/me', meRoutes)
    .route('/tasks', taskRoutes)
    .route('/transactions', transactionRoutes)
    .route('/budget', budgetRoutes)
    .route('/events', eventRoutes)
    .route('/family', familyRoutes)
    .route('/notifications', notificationRoutes)
    .notFound((c) => c.json({ error: 'Не найдено' }, 404))
    .onError(errorHandler)

  const app = new Hono()
  if (config.env === 'development') app.use(logger())
  app.use(secureHeaders())
  app.route('/api', api)

  // В проде API может сам раздавать собранный фронтенд (SPA с fallback на index.html)
  if (config.webDistDir) {
    const root = path.resolve(config.webDistDir)
    const indexHtml = path.join(root, 'index.html')
    if (!existsSync(indexHtml)) throw new Error(`WEB_DIST_DIR: не найден ${indexHtml}`)
    app.use('*', serveStatic({ root: path.relative(process.cwd(), root) }))
    app.get('*', async (c) => c.html(await readFile(indexHtml, 'utf8')))
  }

  return app
}
