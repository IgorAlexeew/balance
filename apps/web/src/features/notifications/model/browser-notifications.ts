import { useSyncExternalStore } from 'react'

type Permission = NotificationPermission | 'unsupported'

const listeners = new Set<() => void>()

function getPermission(): Permission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Разрешение на системные уведомления браузера */
export function useBrowserNotificationPermission() {
  const permission = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getPermission,
    () => 'unsupported' as Permission,
  )
  const request = async () => {
    if (typeof Notification === 'undefined') return
    await Notification.requestPermission()
    listeners.forEach((l) => l())
  }
  return { permission, request }
}

export function showBrowserNotification(title: string, body: string) {
  if (getPermission() !== 'granted' || document.visibilityState === 'visible') return
  try {
    new Notification(title, { body, icon: '/favicon.svg' })
  } catch {
    // На некоторых мобильных браузерах конструктор Notification недоступен
  }
}
