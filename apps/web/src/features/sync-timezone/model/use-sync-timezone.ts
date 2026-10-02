import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sessionApi, sessionKeys, useViewer } from '@/entities/session'

/**
 * Напоминания «каждый день в 9:00» сервер считает в часовом поясе пользователя —
 * синхронизируем его с поясом браузера.
 */
export function useSyncTimezone() {
  const queryClient = useQueryClient()
  const { data: viewer } = useViewer()

  useEffect(() => {
    if (!viewer) return
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!browserTz || browserTz === viewer.timezone) return
    sessionApi
      .updateMe({ timezone: browserTz })
      .then((updated) => queryClient.setQueryData(sessionKeys.viewer, updated))
      .catch(() => undefined)
  }, [viewer, queryClient])
}
