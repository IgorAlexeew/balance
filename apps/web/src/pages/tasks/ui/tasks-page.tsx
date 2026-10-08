import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ListTodo, Plus } from 'lucide-react'
import { TASK_FILTERS, type TaskDTO, type TaskFilter } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import { useViewer } from '@/entities/session'
import { useTasks } from '@/entities/task'
import { TaskDialog } from '@/features/task-edit'
import { TaskCard } from '@/widgets/task-list'
import { useDialogState } from '@/shared/lib/use-dialog-state'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const FILTER_LABELS: Record<TaskFilter, string> = {
  all: 'Все',
  todo: 'Активные',
  overdue: 'Просроченные',
  done: 'Выполненные',
}

const EMPTY_STATES: Record<TaskFilter, { icon: typeof ListTodo; title: string; hint: string }> = {
  all: {
    icon: ListTodo,
    title: 'Задач пока нет',
    hint: 'Создайте первую задачу и настройте гибкое напоминание',
  },
  todo: {
    icon: ListTodo,
    title: 'Активных задач пока нет',
    hint: 'Добавьте задачу — она появится в этом списке',
  },
  overdue: {
    icon: CheckCircle2,
    title: 'Нет просроченных задач — отлично!',
    hint: 'Все задачи выполняются в срок',
  },
  done: { icon: CheckCircle2, title: 'Выполненных задач пока нет', hint: 'Отмечайте задачи выполненными' },
}

export function TasksPage() {
  const { data: viewer } = useViewer()
  const { groupId, group } = useActiveGroup()
  const [filter, setFilter] = useState<TaskFilter>('all')
  const dialog = useDialogState<TaskDTO>()
  const tasksQuery = useTasks(filter, groupId)
  const tasks = tasksQuery.data ?? []
  const empty = EMPTY_STATES[filter]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Задачи</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{group ? group.name : 'Личные задачи'}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => dialog.openWith()}>
          <Plus className="size-4" />
          Новая задача
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskFilter)}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:h-9 sm:w-auto">
          {TASK_FILTERS.map((f) => (
            <TabsTrigger key={f} value={f}>
              {FILTER_LABELS[f]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tasksQuery.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="rounded-xl border py-0 shadow-sm">
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.hint}
            action={
              <Button size="sm" variant="outline" onClick={() => dialog.openWith()}>
                <Plus className="size-3.5" />
                Создать задачу
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          className="space-y-2.5"
        >
          {tasks.map((t) => (
            <motion.div key={t.id} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <TaskCard task={t} currentUserId={viewer?.id ?? null} onEdit={dialog.openWith} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <TaskDialog key={dialog.key} open={dialog.open} onOpenChange={dialog.setOpen} task={dialog.target} />
    </div>
  )
}
