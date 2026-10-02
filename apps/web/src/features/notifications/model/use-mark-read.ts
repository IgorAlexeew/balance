import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { NotificationsMarkReadInput } from '@balance/contracts'
import { notificationApi, notificationKeys } from '@/entities/notification'

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NotificationsMarkReadInput) => notificationApi.markRead(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
