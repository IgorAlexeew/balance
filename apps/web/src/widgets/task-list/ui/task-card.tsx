import { BellRing, Clock, Pencil, UserRound } from 'lucide-react'
import type { TaskDTO } from '@balance/contracts'
import { humanizeReminder, isOverdueTask, PriorityChip } from '@/entities/task'
import { TaskDoneCheckbox } from '@/features/task-complete'
import { DeleteTaskButton } from '@/features/task-delete'
import { cn } from '@/shared/lib/cn'
import { fmtTime, relativeDay } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

export function TaskCard({
  task,
  currentUserId,
  onEdit,
}: {
  task: TaskDTO
  currentUserId: string | null
  onEdit: (task: TaskDTO) => void
}) {
  const done = task.status === 'done'
  const overdue = isOverdueTask(task)
  const showAuthor = !!task.createdByName && task.createdById !== currentUserId

  return (
    <Card className="gap-0 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <TaskDoneCheckbox task={task} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-sm leading-snug font-medium break-words',
              done && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </div>
          {task.description && (
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.description}</div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PriorityChip priority={task.priority} />
            {task.deadline && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  overdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
                )}
              >
                <Clock className="size-3" />
                {relativeDay(task.deadline)}, {fmtTime(task.deadline)}
              </span>
            )}
            {task.reminder && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <BellRing className="size-3" />
                {humanizeReminder(task.reminder)}
              </span>
            )}
            {task.assigneeName && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <UserRound className="size-3" />
                {task.assigneeName}
              </span>
            )}
            {showAuthor && <span className="text-xs text-muted-foreground">от {task.createdByName}</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onEdit(task)}
            aria-label={`Редактировать задачу «${task.title}»`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <DeleteTaskButton task={task} />
        </div>
      </div>
    </Card>
  )
}
