import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useActiveGroupStore } from '@/entities/family-group'
import { sessionApi, sessionKeys } from '@/entities/session'
import { routes } from '@/shared/config'

export function useDemoLogin() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (name: string) => sessionApi.demoLogin({ name: name.trim() || undefined }),
    onSuccess: async () => {
      queryClient.clear()
      await navigate(routes.dashboard, { replace: true })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const resetGroup = useActiveGroupStore((s) => s.setActiveGroupId)
  return useMutation({
    mutationFn: sessionApi.logout,
    onSettled: async () => {
      resetGroup(null)
      // Сначала уходим со страниц приложения, затем чистим кеш — иначе
      // ещё смонтированные запросы успеют перезапроситься уже без сессии
      queryClient.setQueryData(sessionKeys.viewer, null)
      await navigate(routes.login, { replace: true })
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
    },
  })
}

export function startYandexLogin() {
  window.location.assign(sessionApi.yandexLoginUrl)
}
