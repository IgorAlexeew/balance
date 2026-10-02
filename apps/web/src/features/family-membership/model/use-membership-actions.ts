import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { familyApi, familyKeys, useActiveGroupStore } from '@/entities/family-group'

/** Выход из группы, удаление и смена кода приглашения */
export function useMembershipActions() {
  const queryClient = useQueryClient()
  const { activeGroupId, setActiveGroupId } = useActiveGroupStore()

  const afterLeave = (groupId: string) => {
    if (groupId === activeGroupId) setActiveGroupId(null)
    // Данные группы могли быть в любых кешах — сбрасываем всё, кроме сессии
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
  }

  const leave = useMutation({
    mutationFn: (groupId: string) => familyApi.leave(groupId),
    onSuccess: (_data, groupId) => {
      toast.success('Вы вышли из группы')
      afterLeave(groupId)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (groupId: string) => familyApi.remove(groupId),
    onSuccess: (_data, groupId) => {
      toast.success('Группа удалена')
      afterLeave(groupId)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const regenerateCode = useMutation({
    mutationFn: (groupId: string) => familyApi.regenerateInviteCode(groupId),
    onSuccess: () => {
      toast.success('Код обновлён — старый больше не работает')
      void queryClient.invalidateQueries({ queryKey: familyKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return { leave, remove, regenerateCode }
}
