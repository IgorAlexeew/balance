import type { AppConfigDTO, DemoLoginInput, MeUpdateInput, SessionDTO, UserDTO } from '@balance/contracts'
import { http } from '@/shared/api'

export const sessionApi = {
  session: () => http.get<SessionDTO>('/session'),
  updateMe: (input: MeUpdateInput) => http.patch<UserDTO>('/me', input),
  config: () => http.get<AppConfigDTO>('/config'),
  demoLogin: (input: DemoLoginInput) => http.post<{ ok: true }>('/auth/demo', input),
  logout: () => http.post<{ ok: true }>('/auth/logout'),
  /** Вход через Яндекс — полноценный переход на страницу OAuth */
  yandexLoginUrl: '/api/auth/yandex',
}
