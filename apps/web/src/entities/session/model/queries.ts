import { useQuery } from '@tanstack/react-query'
import { sessionApi } from '../api/session-api'

export const sessionKeys = {
  viewer: ['session', 'viewer'] as const,
  config: ['session', 'config'] as const,
}

/** Текущий пользователь; null — не авторизован */
export function useViewer() {
  return useQuery({
    queryKey: sessionKeys.viewer,
    queryFn: async () => (await sessionApi.session()).user,
    staleTime: 5 * 60_000,
  })
}

export function useAppConfig() {
  return useQuery({ queryKey: sessionKeys.config, queryFn: sessionApi.config, staleTime: Infinity })
}
