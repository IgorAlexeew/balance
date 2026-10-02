import { z } from 'zod'
import { timeZoneSchema } from '@balance/contracts'

/** Пустые строки из .env считаем «не задано» */
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional())
const flag = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  APP_URL: z.url().default('http://localhost:5173'),
  PORT: z.coerce.number().int().positive().default(3001),
  DEFAULT_TIMEZONE: timeZoneSchema.default('Europe/Moscow'),
  YANDEX_CLIENT_ID: optional,
  YANDEX_CLIENT_SECRET: optional,
  DEMO_LOGIN: flag,
  AI_API_URL: optional,
  AI_API_KEY: optional,
  AI_MODEL: optional,
  /** Каталог со сборкой фронтенда: если задан, API раздаёт её сам (одна точка входа в проде) */
  WEB_DIST_DIR: optional,
})

export interface AppConfig {
  env: 'development' | 'production' | 'test'
  port: number
  /** Origin фронтенда, например http://localhost:5173 */
  appOrigin: string
  appUrl: string
  secureCookies: boolean
  defaultTimezone: string
  yandex: { clientId: string; clientSecret: string } | null
  demoLogin: boolean
  ai: { url: string; apiKey: string; model: string } | null
  webDistDir: string | null
  /** Фоновые задачи (напоминания, очистка сессий); в тестах выключены */
  schedulerEnabled: boolean
}

/** DI-токен конфигурации */
export const APP_CONFIG = Symbol('APP_CONFIG')

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Некорректная конфигурация окружения:\n${details}`)
  }
  const e = parsed.data
  const appUrl = new URL(e.APP_URL)
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    appOrigin: appUrl.origin,
    appUrl: appUrl.origin + appUrl.pathname.replace(/\/$/, ''),
    secureCookies: appUrl.protocol === 'https:',
    defaultTimezone: e.DEFAULT_TIMEZONE,
    yandex:
      e.YANDEX_CLIENT_ID && e.YANDEX_CLIENT_SECRET
        ? { clientId: e.YANDEX_CLIENT_ID, clientSecret: e.YANDEX_CLIENT_SECRET }
        : null,
    // Демо-вход без пароля в проде недоступен ни при каких настройках
    demoLogin: e.DEMO_LOGIN && e.NODE_ENV !== 'production',
    ai:
      e.AI_API_URL && e.AI_API_KEY && e.AI_MODEL
        ? { url: e.AI_API_URL.replace(/\/$/, ''), apiKey: e.AI_API_KEY, model: e.AI_MODEL }
        : null,
    webDistDir: e.WEB_DIST_DIR ?? null,
    schedulerEnabled: e.NODE_ENV !== 'test',
  }
}
