import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { AppConfig } from '../config/app-config'
import { InjectConfig } from '../config/inject-config'
import { ApiError } from './api-error'
import type { AppRequest } from './request'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Защита от CSRF для cookie-сессий (в дополнение к SameSite=Lax):
 * изменяющие запросы из браузера принимаются только с Origin фронтенда,
 * а тело — только как application/json (с чужого сайта такой запрос
 * невозможен без CORS-preflight, а CORS мы не разрешаем).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@InjectConfig() private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>()
    if (SAFE_METHODS.has(req.method)) return true

    const origin = req.headers.origin
    if (origin) {
      if (origin !== this.config.appOrigin) throw new ApiError(403, 'Запрос с чужого источника отклонён')
    } else {
      const site = req.headers['sec-fetch-site']
      if (site && site !== 'same-origin' && site !== 'none') {
        throw new ApiError(403, 'Запрос с чужого источника отклонён')
      }
    }

    const length = Number(req.headers['content-length'] ?? 0)
    const hasBody = length > 0 || req.headers['transfer-encoding'] !== undefined
    if (hasBody && !req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      throw new ApiError(415, 'Ожидается тело запроса в формате JSON')
    }
    return true
  }
}
