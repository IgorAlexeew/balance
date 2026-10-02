import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useFamilyGroups } from './queries'

interface ActiveGroupState {
  /** null — личные данные, иначе id семейной группы */
  activeGroupId: string | null
  setActiveGroupId: (groupId: string | null) => void
}

export const useActiveGroupStore = create<ActiveGroupState>()(
  persist(
    (set) => ({
      activeGroupId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
    }),
    { name: 'lifebalance:active-group' },
  ),
)

/**
 * Активный контекст данных. Если сохранённой группы больше нет
 * (вышли или её удалили), контекст считается личным.
 */
export function useActiveGroup() {
  const storedId = useActiveGroupStore((s) => s.activeGroupId)
  const setActiveGroupId = useActiveGroupStore((s) => s.setActiveGroupId)
  const groupsQuery = useFamilyGroups()
  const groups = groupsQuery.data ?? []
  const group = storedId ? (groups.find((g) => g.id === storedId) ?? null) : null
  // Пока список групп грузится, доверяем сохранённому id, чтобы не мигать личными данными
  const groupId = groupsQuery.isSuccess ? (group?.id ?? null) : storedId
  return { groupId, group, groups, setActiveGroupId, isLoading: groupsQuery.isLoading }
}
