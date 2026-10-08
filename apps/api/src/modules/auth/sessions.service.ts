import { createHash, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { AppConfig } from '../../config/app-config'
import { InjectConfig } from '../../config/inject-config'
import { PrismaService } from '../../prisma/prisma.service'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Продлеваем сессию, когда до истечения осталось меньше половины срока */
const SESSION_RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Серверные сессии: в cookie — случайный токен, в БД — только его SHA-256 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  get cookieName(): string {
    // __Host- запрещает подмену cookie с поддоменов, но требует Secure
    return this.config.secureCookies ? '__Host-lb_session' : 'lb_session'
  }

  async create(res: Response, userId: string): Promise<void> {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await this.prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } })
    this.writeCookie(res, token, expiresAt)
  }

  /** Пользователь по cookie сессии; просроченные сессии удаляются, живые — продлеваются */
  async resolve(req: Request, res: Response) {
    const token: unknown = req.cookies?.[this.cookieName]
    if (typeof token !== 'string' || !token) return null
    const tokenHash = hashToken(token)
    const session = await this.prisma.session.findUnique({ where: { tokenHash }, include: { user: true } })
    if (!session) return null
    const now = Date.now()
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
      return null
    }
    if (session.expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
      const expiresAt = new Date(now + SESSION_TTL_MS)
      await this.prisma.session.update({ where: { id: session.id }, data: { expiresAt } })
      this.writeCookie(res, token, expiresAt)
    }
    return { user: session.user, tokenHash }
  }

  async destroy(res: Response, tokenHash: string | null): Promise<void> {
    if (tokenHash) await this.prisma.session.deleteMany({ where: { tokenHash } })
    res.clearCookie(this.cookieName, {
      path: '/',
      secure: this.config.secureCookies,
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  async purgeExpired(): Promise<number> {
    const res = await this.prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })
    return res.count
  }

  private writeCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
  }
}
