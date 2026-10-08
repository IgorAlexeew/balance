import { useQuery } from '@tanstack/react-query'
import { notificationApi } from '../api/notification-api'

export const notificationKeys = {
  all: ['notifications'] as const,
}

/** Уведомления создаёт сервер (планировщик напоминаний) — периодически подтягиваем */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: notificationApi.list,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })
}
