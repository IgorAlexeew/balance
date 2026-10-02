import { createHash, randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppConfig } from '../../config'
import { prisma } from '../../db'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Продлеваем сессию, когда до истечения осталось меньше половины срока */
const SESSION_RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2

export function sessionCookieName(config: AppConfig): string {
  // __Host- запрещает подмену cookie с поддоменов, но требует Secure
  return config.secureCookies ? '__Host-lb_session' : 'lb_session'
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(c: Context, userId: string, config: AppConfig): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } })
  writeSessionCookie(c, token, expiresAt, config)
}

function writeSessionCookie(c: Context, token: string, expiresAt: Date, config: AppConfig) {
  setCookie(c, sessionCookieName(config), token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  })
}

/** Находит пользователя по cookie сессии; просроченные сессии удаляет */
export async function resolveSession(c: Context, config: AppConfig) {
  const token = getCookie(c, sessionCookieName(config))
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } })
  if (!session) return null
  const now = Date.now()
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (session.expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS)
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } })
    writeSessionCookie(c, token, expiresAt, config)
  }
  return { user: session.user, tokenHash }
}

export async function destroySession(c: Context, tokenHash: string | null, config: AppConfig) {
  if (tokenHash) await prisma.session.deleteMany({ where: { tokenHash } })
  deleteCookie(c, sessionCookieName(config), { path: '/', secure: config.secureCookies })
}

export async function purgeExpiredSessions(): Promise<number> {
  const res = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  return res.count
}
