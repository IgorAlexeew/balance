import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

/** Переключатель месяца: ‹ Октябрь 2026 › [Сегодня] */
export function MonthSwitcher({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon" className="size-8" aria-label="Предыдущий месяц" onClick={onPrev}>
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-40 text-center text-sm font-semibold capitalize select-none">{label}</div>
      <Button variant="outline" size="icon" className="size-8" aria-label="Следующий месяц" onClick={onNext}>
        <ChevronRight className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onToday}>
        Сегодня
      </Button>
    </div>
  )
}
