import { create } from 'zustand'

export type ViewName = 'dashboard' | 'tasks' | 'budget' | 'calendar' | 'family'

interface AppState {
  /** Активная вкладка */
  view: ViewName
  setView: (view: ViewName) => void
  /** Контекст данных: null = личные, иначе id семейной группы */
  groupId: string | null
  setGroupId: (groupId: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),
  groupId: null,
  setGroupId: (groupId) => set({ groupId }),
}))
