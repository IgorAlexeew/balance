import type { TaskDTO } from '@balance/contracts'
import { Checkbox } from '@/shared/ui/checkbox'
import { useToggleTask } from '../model/use-toggle-task'

export function TaskDoneCheckbox({ task, className }: { task: TaskDTO; className?: string }) {
  const toggle = useToggleTask(task)
  return (
    <Checkbox
      checked={task.status === 'done'}
      onCheckedChange={() => toggle.mutate()}
      disabled={toggle.isPending}
      className={className}
      aria-label={`Отметить задачу «${task.title}»`}
    />
  )
}
