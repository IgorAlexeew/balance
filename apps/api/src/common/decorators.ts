import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import type { User } from '@prisma/client'
import type { AppRequest } from './request'

export const IS_PUBLIC = 'isPublic'

/** Эндпоинт доступен без авторизации */
export const Public = () => SetMetadata(IS_PUBLIC, true)

/** Пользователь сессии (гарантирован SessionGuard на непубличных эндпоинтах) */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const user = ctx.switchToHttp().getRequest<AppRequest>().user
  if (!user) throw new Error('CurrentUser used on a public endpoint')
  return user
})
