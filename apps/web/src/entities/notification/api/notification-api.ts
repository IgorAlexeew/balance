import type { NotificationDTO, NotificationsMarkReadInput } from '@balance/contracts'
import { http } from '@/shared/api'

export const notificationApi = {
  list: () => http.get<NotificationDTO[]>('/notifications'),
  markRead: (input: NotificationsMarkReadInput) => http.post<{ ok: true }>('/notifications/read', input),
}
