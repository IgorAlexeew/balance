import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { ApiError } from './api-error'
import type { AppRequest } from './request'

/** Лимит запросов по пользователю (для гостей — по IP) */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as AppRequest
    return request.user?.id ?? request.ip ?? 'unknown'
  }

  protected override async throwThrottlingException(): Promise<void> {
    throw new ApiError(429, 'Слишком много запросов, попробуйте позже')
  }
}
