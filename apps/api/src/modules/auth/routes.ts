import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { demoLoginSchema, type AppConfigDTO, type SessionDTO } from '@balance/contracts'
import { prisma } from '../../db'
import { notFound } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { ensureDemoUser } from '../../seed/demo'
import { userToDTO } from '../me/routes'
import type { AppEnv } from '../../types'
import { createSession, destroySession, resolveSession } from './sessions'
import { buildAuthorizeUrl, fetchYandexProfile } from './yandex'

const STATE_COOKIE = 'lb_oauth_state'

export const authRoutes = new Hono<AppEnv>()

/** Публичная конфигурация: какие способы входа и функции включены */
authRoutes.get('/config', (c) => {
  const config = c.get('config')
  const body: AppConfigDTO = {
    auth: { yandex: config.yandex !== null, demo: config.demoLogin },
    features: { aiAnalysis: config.ai !== null },
  }
  return c.json(body)
})

/** Текущая сессия; для гостя — user: null (без 401, чтобы не шуметь в консоли) */
authRoutes.get('/session', async (c) => {
  const resolved = await resolveSession(c, c.get('config'))
  const body: SessionDTO = { user: resolved ? userToDTO(resolved.user) : null }
  return c.json(body)
})

authRoutes.get('/auth/yandex', (c) => {
  const config = c.get('config')
  if (!config.yandex) throw notFound('Вход через Яндекс ID не настроен')
  const state = randomBytes(16).toString('base64url')
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'Lax',
    path: '/api/auth/yandex',
    maxAge: 10 * 60,
  })
  const redirectUri = `${config.appUrl}/api/auth/yandex/callback`
  return c.redirect(buildAuthorizeUrl(config.yandex, redirectUri, state))
})

authRoutes.get('/auth/yandex/callback', async (c) => {
  const config = c.get('config')
  const fail = (reason: string) => c.redirect(`${config.appUrl}/login?error=${reason}`)
  if (!config.yandex) return fail('yandex_disabled')

  const expectedState = getCookie(c, STATE_COOKIE)
  deleteCookie(c, STATE_COOKIE, { path: '/api/auth/yandex', secure: config.secureCookies })
  const state = c.req.query('state')
  const code = c.req.query('code')
  if (c.req.query('error')) return fail('yandex_denied')
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) return fail('yandex_state')

  let profile
  try {
    profile = await fetchYandexProfile(config.yandex, code)
  } catch (e) {
    console.error('[auth] yandex login failed', e)
    return fail('yandex_failed')
  }

  // Пользователь определяется по id аккаунта Яндекса, а не по email
  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'yandex', providerAccountId: profile.id } },
  })
  let userId = account?.userId
  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: profile.name ?? undefined, email: profile.email, image: profile.image },
    })
  } else {
    const user = await prisma.user.create({
      data: {
        name: profile.name ?? 'Пользователь Яндекса',
        email: profile.email,
        image: profile.image,
        timezone: config.defaultTimezone,
        accounts: { create: { provider: 'yandex', providerAccountId: profile.id } },
      },
    })
    userId = user.id
  }

  await createSession(c, userId, config)
  return c.redirect(`${config.appUrl}/`)
})

/** Демо-вход без пароля — только для локальной разработки */
authRoutes.post('/auth/demo', validate('json', demoLoginSchema), async (c) => {
  const config = c.get('config')
  if (!config.demoLogin) throw notFound('Демо-вход отключён')
  const { name } = c.req.valid('json')
  const user = await ensureDemoUser(name || null, config.defaultTimezone)
  await createSession(c, user.id, config)
  return c.json({ ok: true })
})

authRoutes.post('/auth/logout', async (c) => {
  const config = c.get('config')
  const resolved = await resolveSession(c, config)
  await destroySession(c, resolved?.tokenHash ?? null, config)
  return c.json({ ok: true })
})

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
