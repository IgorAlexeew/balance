import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

/** Ключ в localStorage; его же читает inline-скрипт в index.html, чтобы не было вспышки темы */
export const THEME_STORAGE_KEY = 'lifebalance:theme'

const useThemeStore = create<{ theme: Theme; setTheme: (theme: Theme) => void }>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), { name: THEME_STORAGE_KEY }),
)

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = darkQuery()
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => darkQuery().matches,
    () => false,
  )
}

export function useTheme() {
  const { theme, setTheme } = useThemeStore()
  const systemDark = useSystemDark()
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  return { theme, resolvedTheme, setTheme }
}

/** Применяет тему к <html>; вызывается один раз в корне приложения */
export function useApplyTheme() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])
}
