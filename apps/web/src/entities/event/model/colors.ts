import type { EventColor } from '@balance/contracts'

/** Классы цветов событий (полными строками, чтобы Tailwind их не вырезал) */
export const EVENT_COLOR_CLASSES: Record<
  EventColor,
  { chip: string; dot: string; hex: string; title: string }
> = {
  emerald: {
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-l-2 border-emerald-500',
    dot: 'bg-emerald-500',
    hex: '#10b981',
    title: 'Изумрудный',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-l-2 border-amber-500',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
    title: 'Янтарный',
  },
  rose: {
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-l-2 border-rose-500',
    dot: 'bg-rose-500',
    hex: '#f43f5e',
    title: 'Розовый',
  },
  violet: {
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border-l-2 border-violet-500',
    dot: 'bg-violet-500',
    hex: '#8b5cf6',
    title: 'Фиолетовый',
  },
  teal: {
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-l-2 border-teal-500',
    dot: 'bg-teal-500',
    hex: '#14b8a6',
    title: 'Бирюзовый',
  },
  orange: {
    chip: 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border-l-2 border-orange-500',
    dot: 'bg-orange-500',
    hex: '#f97316',
    title: 'Оранжевый',
  },
}
