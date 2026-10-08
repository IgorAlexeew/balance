import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useNotifications } from '@/entities/notification'
import { routes } from '@/shared/config'
import { showBrowserNotification } from './browser-notifications'

/**
 * Показывает тост (и системное уведомление, если вкладка в фоне) для новых
 * непрочитанных уведомлений, появившихся после открытия приложения.
 */
export function useNewNotificationsToaster() {
  const navigate = useNavigate()
  const { data } = useNotifications()
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!data) return
    if (seen.current === null) {
      seen.current = new Set(data.map((n) => n.id))
      return
    }
    const fresh = data.filter((n) => !n.read && !seen.current!.has(n.id))
    for (const n of fresh) {
      seen.current.add(n.id)
      toast(n.title, {
        description: n.body,
        duration: 12_000,
        action: n.taskId ? { label: 'К задачам', onClick: () => void navigate(routes.tasks) } : undefined,
      })
      showBrowserNotification(n.title, n.body)
    }
  }, [data, navigate])
}
