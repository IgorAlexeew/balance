// Категории бюджета — общий список для клиента и сервера.
// ВАЖНО: классы Tailwind указаны полными строками, чтобы JIT их не вырезал.

export interface CategoryDef {
  name: string
  icon: string
  chipClass: string // классы для чипа категории
  dotClass: string // класс для точки в легенде
}

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { name: 'Продукты', icon: '🛒', chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', dotClass: 'bg-emerald-500' },
  { name: 'Кафе и рестораны', icon: '☕', chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', dotClass: 'bg-amber-500' },
  { name: 'Транспорт', icon: '🚗', chipClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300', dotClass: 'bg-teal-500' },
  { name: 'Жильё и ЖКХ', icon: '🏠', chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', dotClass: 'bg-rose-500' },
  { name: 'Здоровье', icon: '💊', chipClass: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300', dotClass: 'bg-pink-500' },
  { name: 'Развлечения', icon: '🎬', chipClass: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300', dotClass: 'bg-violet-500' },
  { name: 'Одежда', icon: '👕', chipClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300', dotClass: 'bg-orange-500' },
  { name: 'Связь и интернет', icon: '📱', chipClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300', dotClass: 'bg-cyan-500' },
  { name: 'Образование', icon: '📚', chipClass: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300', dotClass: 'bg-lime-500' },
  { name: 'Спорт', icon: '⚽', chipClass: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300', dotClass: 'bg-green-500' },
  { name: 'Подарки', icon: '🎁', chipClass: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300', dotClass: 'bg-fuchsia-500' },
  { name: 'Дом и быт', icon: '🧴', chipClass: 'bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-300', dotClass: 'bg-stone-500' },
  { name: 'Прочие расходы', icon: '📦', chipClass: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300', dotClass: 'bg-slate-500' },
]

export const INCOME_CATEGORIES: CategoryDef[] = [
  { name: 'Зарплата', icon: '💼', chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', dotClass: 'bg-emerald-500' },
  { name: 'Фриланс', icon: '💻', chipClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300', dotClass: 'bg-teal-500' },
  { name: 'Подработка', icon: '🔧', chipClass: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300', dotClass: 'bg-lime-500' },
  { name: 'Подарки и переводы', icon: '💝', chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', dotClass: 'bg-amber-500' },
  { name: 'Инвестиции', icon: '📈', chipClass: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300', dotClass: 'bg-violet-500' },
  { name: 'Прочие доходы', icon: '➕', chipClass: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300', dotClass: 'bg-slate-500' },
]

export const ALL_CATEGORIES: CategoryDef[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

const FALLBACK: CategoryDef = {
  name: 'Другое',
  icon: '🏷️',
  chipClass: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
  dotClass: 'bg-slate-500',
}

export function getCategory(name: string): CategoryDef {
  return ALL_CATEGORIES.find((c) => c.name === name) ?? { ...FALLBACK, name }
}
