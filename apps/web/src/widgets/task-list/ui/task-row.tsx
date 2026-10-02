import { BellRing, Clock } from 'lucide-react'
import type { TaskDTO } from '@balance/contracts'
import { humanizeReminder, PriorityChip } from '@/entities/task'
import { TaskDoneCheckbox } from '@/features/task-complete'
import { fmtTime } from '@/shared/lib/format'

/** Компактная строка задачи для сводок */
export function TaskRow({ task }: { task: TaskDTO }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <TaskDoneCheckbox task={task} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm leading-snug font-medium">{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.deadline && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {fmtTime(task.deadline)}
            </span>
          )}
          <PriorityChip priority={task.priority} />
          {task.assigneeName && (
            <span className="text-[11px] text-muted-foreground">→ {task.assigneeName}</span>
          )}
        </div>
      </div>
      {task.reminder && (
        <span title={humanizeReminder(task.reminder)} className="mt-0.5 shrink-0 text-muted-foreground">
          <BellRing className="size-3.5" />
        </span>
      )}
    </div>
  )
}
