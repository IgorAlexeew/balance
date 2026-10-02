import { cn } from '@/shared/lib/cn'
import { getCategory } from '../model/categories'

export function CategoryChip({ category }: { category: string }) {
  const cat = getCategory(category)
  return (
    <span
      className={cn(
        'inline-flex max-w-40 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        cat.chipClass,
      )}
    >
      <span className="shrink-0 leading-none">{cat.icon}</span>
      <span className="min-w-0 truncate">{category}</span>
    </span>
  )
}

export function CategoryIcon({ category }: { category: string }) {
  const cat = getCategory(category)
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-base', cat.chipClass)}>
      {cat.icon}
    </span>
  )
}
