import type { TaskPriority } from '@balance/contracts'
import { cn } from '@/shared/lib/cn'
import { PRIORITY_CHIP_CLASSES, PRIORITY_LABELS } from '../lib/labels'

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium',
        PRIORITY_CHIP_CLASSES[priority],
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
