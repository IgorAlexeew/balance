import 'reflect-metadata'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { AppModule } from './app.module'
import type { AppConfig } from './config/app-config'

const API_PREFIX = 'api'

/** Ошибки парсинга тела (битый JSON, слишком большой запрос) — в формате API */
const bodyErrorHandler: ErrorRequestHandler = (err: { status?: number; type?: string }, _req, res, next) => {
  if (err.type === 'entity.too.large') return void res.status(413).json({ error: 'Слишком большой запрос' })
  if (err.status === 400) return void res.status(400).json({ error: 'Некорректное тело запроса' })
  next(err)
}

export async function createApp(config: AppConfig): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    bodyParser: false,
    logger: config.env === 'test' ? false : undefined,
  })
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  // CSP не включаем: SPA использует inline-скрипт для темы до первого рендера
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cookieParser())
  app.use(express.json({ limit: '256kb' }))
  app.use(bodyErrorHandler)
  app.setGlobalPrefix(API_PREFIX)
  app.enableShutdownHooks()

  // В проде API может сам раздавать собранный фронтенд (SPA с fallback на index.html)
  if (config.webDistDir) {
    const root = path.resolve(config.webDistDir)
    const indexHtml = path.join(root, 'index.html')
    if (!existsSync(indexHtml)) throw new Error(`WEB_DIST_DIR: не найден ${indexHtml}`)
    app.useStaticAssets(root, { index: false })
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith(`/${API_PREFIX}/`)) return res.sendFile(indexHtml)
      next()
    })
  }

  await app.init()
  return app
}
