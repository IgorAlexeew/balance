import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import { ApiError } from '../../common/api-error'
import { IS_PUBLIC } from '../../common/decorators'
import type { AppRequest } from '../../common/request'
import { SessionsService } from './sessions.service'

/** Глобальный guard: определяет пользователя по cookie; без сессии — 401, кроме @Public() */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp()
    const req = http.getRequest<AppRequest>()
    const resolved = await this.sessions.resolve(req, http.getResponse<Response>())
    req.user = resolved?.user
    req.sessionTokenHash = resolved?.tokenHash ?? null

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!resolved && !isPublic) throw new ApiError(401, 'Требуется авторизация')
    return true
  }
}
