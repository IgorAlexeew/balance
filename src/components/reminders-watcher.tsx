'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'

/**
 * Следит за наступлением напоминаний: опрашивает /api/reminders/due,
 * показывает тосты и браузерные уведомления.
 */
export function RemindersWatcher() {
  const queryClient = useQueryClient()
  const setView = useAppStore((s) => s.setView)
  const runningRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const notify = (title: string, body: string) => {
      toast(title, {
        description: body,
        duration: 12_000,
        action: {
          label: 'К задачам',
          onClick: () => setView('tasks'),
        },
      })
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body, icon: 'https://z-cdn.chatglm.cn/z-ai/static/logo.svg' })
        }
      } catch {
        /* браузерные уведомления недоступны */
      }
    }

    const check = async () => {
      if (runningRef.current || cancelled) return
      runningRef.current = true
      try {
        const tz = -new Date().getTimezoneOffset()
        const fired = await api.reminders.due(tz)
        if (!cancelled && fired.length > 0) {
          for (const n of fired.slice(0, 5)) notify(n.title, n.body)
          await queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      } catch {
        /* тихо игнорируем сетевые ошибки опроса */
      } finally {
        runningRef.current = false
      }
    }

    // Запрашиваем разрешение на браузерные уведомления (может быть отклонено)
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
    } catch {
      /* ignore */
    }

    void check()
    const interval = setInterval(check, 45_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [queryClient, setView])

  return null
}
