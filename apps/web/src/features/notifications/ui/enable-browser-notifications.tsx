import { BellRing } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useBrowserNotificationPermission } from '../model/browser-notifications'

/** Разрешение запрашиваем только по явному действию пользователя */
export function EnableBrowserNotifications() {
  const { permission, request } = useBrowserNotificationPermission()
  if (permission !== 'default') return null
  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void request()}>
      <BellRing className="size-3.5" />
      Уведомления в браузере
    </Button>
  )
}
