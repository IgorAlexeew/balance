import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common'
import type { Response } from 'express'
import { demoLoginSchema, type AppConfigDTO, type DemoLoginInput, type SessionDTO } from '@balance/contracts'
import { notFound } from '../../common/api-error'
import { Public } from '../../common/decorators'
import type { AppRequest } from '../../common/request'
import { ZodPipe } from '../../common/zod.pipe'
import type { AppConfig } from '../../config/app-config'
import { InjectConfig } from '../../config/inject-config'
import { PrismaService } from '../../prisma/prisma.service'
import { ensureDemoUser } from '../../seed/demo'
import { SessionsService } from './sessions.service'
import { userToDTO } from './user.mapper'
import { buildAuthorizeUrl, fetchYandexProfile } from './yandex'

const STATE_COOKIE = 'lb_oauth_state'
const STATE_COOKIE_PATH = '/api/auth/yandex'

@Public()
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  /** Публичная конфигурация: какие способы входа и функции включены */
  @Get('config')
  getConfig(): AppConfigDTO {
    return {
      auth: { yandex: this.config.yandex !== null, demo: this.config.demoLogin },
      features: { aiAnalysis: this.config.ai !== null },
    }
  }

  /** Текущая сессия; для гостя — user: null (без 401, чтобы не шуметь в консоли) */
  @Get('session')
  getSession(@Req() req: AppRequest): SessionDTO {
    return { user: req.user ? userToDTO(req.user) : null }
  }

  @Get('auth/yandex')
  startYandex(@Res() res: Response) {
    if (!this.config.yandex) throw notFound('Вход через Яндекс ID не настроен')
    const state = randomBytes(16).toString('base64url')
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    })
    const redirectUri = `${this.config.appUrl}/api/auth/yandex/callback`
    res.redirect(buildAuthorizeUrl(this.config.yandex, redirectUri, state))
  }

  @Get('auth/yandex/callback')
  async yandexCallback(
    @Req() req: AppRequest,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const fail = (reason: string) => res.redirect(`${this.config.appUrl}/login?error=${reason}`)
    if (!this.config.yandex) return fail('yandex_disabled')

    const expectedState: unknown = req.cookies?.[STATE_COOKIE]
    res.clearCookie(STATE_COOKIE, {
      path: STATE_COOKIE_PATH,
      secure: this.config.secureCookies,
      httpOnly: true,
    })
    if (error) return fail('yandex_denied')
    if (!code || !state || typeof expectedState !== 'string' || !safeEqual(state, expectedState)) {
      return fail('yandex_state')
    }

    let profile
    try {
      profile = await fetchYandexProfile(this.config.yandex, code)
    } catch (e) {
      this.logger.error(`Yandex login failed: ${String(e)}`)
      return fail('yandex_failed')
    }

    // Пользователь определяется по id аккаунта Яндекса, а не по email
    const account = await this.prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: 'yandex', providerAccountId: profile.id } },
    })
    let userId = account?.userId
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { name: profile.name ?? undefined, email: profile.email, image: profile.image },
      })
    } else {
      const user = await this.prisma.user.create({
        data: {
          name: profile.name ?? 'Пользователь Яндекса',
          email: profile.email,
          image: profile.image,
          timezone: this.config.defaultTimezone,
          accounts: { create: { provider: 'yandex', providerAccountId: profile.id } },
        },
      })
      userId = user.id
    }

    await this.sessions.create(res, userId)
    res.redirect(`${this.config.appUrl}/`)
  }

  /** Демо-вход без пароля — только для локальной разработки */
  @Post('auth/demo')
  @HttpCode(200)
  async demoLogin(
    @Body(new ZodPipe(demoLoginSchema)) input: DemoLoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.config.demoLogin) throw notFound('Демо-вход отключён')
    const user = await ensureDemoUser(this.prisma, input.name || null, this.config.defaultTimezone)
    await this.sessions.create(res, user.id)
    return { ok: true }
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    await this.sessions.destroy(res, req.sessionTokenHash ?? null)
    return { ok: true }
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
