'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  BellRing,
  CheckCircle2,
  Clock,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskDialog } from '@/components/task-dialog'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import {
  fmtTime,
  humanizeReminder,
  isOverdueTask,
  PRIORITY_CHIP_CLASSES,
  PRIORITY_LABELS,
  relativeDay,
} from '@/lib/format'
import { useAppStore } from '@/lib/store'
import type { TaskDTO, TaskFilterStatus } from '@/lib/types'

const FILTER_TABS: { value: TaskFilterStatus; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'todo', label: 'Активные' },
  { value: 'overdue', label: 'Просроченные' },
  { value: 'done', label: 'Выполненные' },
]

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

const EMPTY_STATES: Record<
  TaskFilterStatus,
  { icon: typeof ListTodo; title: string; hint: string }
> = {
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
  done: {
    icon: CheckCircle2,
    title: 'Выполненных задач пока нет',
    hint: 'Отмечайте задачи выполненными — они появятся здесь',
  },
}

function TaskCard({
  task,
  currentUserId,
  onEdit,
}: {
  task: TaskDTO
  currentUserId: string | null
  onEdit: (task: TaskDTO) => void
}) {
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: () =>
      api.tasks.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => api.tasks.remove(task.id),
    onSuccess: () => {
      toast.success('Задача удалена')
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const done = task.status === 'done'
  const overdue = isOverdueTask(task)
  const showAuthor = !!task.createdByName && task.createdById !== currentUserId

  return (
    <Card className="rounded-xl border p-4 gap-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={done}
          onCheckedChange={() => toggle.mutate()}
          disabled={toggle.isPending || remove.isPending}
          className="mt-0.5"
          aria-label={`Отметить задачу «${task.title}»`}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-sm font-medium leading-snug break-words',
              done && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {task.description}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className={cn(
                'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
                PRIORITY_CHIP_CLASSES[task.priority]
              )}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
            {task.deadline && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  overdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                )}
              >
                <Clock className="size-3" />
                {relativeDay(task.deadline)}, {fmtTime(task.deadline)}
              </span>
            )}
            {task.reminder && (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title={humanizeReminder(task.reminder)}
              >
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
        <div className="flex items-center gap-0.5 opacity-60 transition-opacity hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onEdit(task)}
            aria-label={`Редактировать задачу «${task.title}»`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Удалить задачу «${task.title}»`}
                disabled={remove.isPending}
              >
                {remove.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
                <AlertDialogDescription>Действие необратимо</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => remove.mutate()}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  )
}

export function TasksView() {
  const { data: session } = useSession()
  const groupId = useAppStore((s) => s.groupId)
  const [filter, setFilter] = useState<TaskFilterStatus>('all')
  // nonce гарантирует реинициализацию диалога (через key) при каждом открытии
  const [dialog, setDialog] = useState<{ open: boolean; task: TaskDTO | null; nonce: number }>({
    open: false,
    task: null,
    nonce: 0,
  })

  const scope = groupId ?? 'personal'
  const groupsQ = useQuery({ queryKey: ['family'], queryFn: api.family.list })
  const activeGroup = groupsQ.data?.find((g) => g.id === groupId) ?? null

  const tasksQ = useQuery({
    queryKey: ['tasks', filter, scope],
    queryFn: () => api.tasks.list({ status: filter, scope }),
  })
  const tasks = tasksQ.data ?? []
  const currentUserId = session?.user?.id ?? null

  const openCreate = () => setDialog((d) => ({ ...d, open: true, task: null, nonce: d.nonce + 1 }))
  const openEdit = (task: TaskDTO) => setDialog((d) => ({ ...d, open: true, task, nonce: d.nonce + 1 }))
  const setDialogOpen = (open: boolean) => setDialog((d) => ({ ...d, open }))

  const empty = EMPTY_STATES[filter]

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Задачи</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {groupId && activeGroup ? activeGroup.name : 'Личный контекст'}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          Новая задача
        </Button>
      </div>

      {/* Фильтр по статусу */}
      <Tabs
        value={filter}
        onValueChange={(v) => {
          const next = FILTER_TABS.find((f) => f.value === v)
          if (next) setFilter(next.value)
        }}
      >
        <TabsList className="grid grid-cols-2 h-auto w-full sm:inline-flex sm:h-9 sm:w-auto">
          {FILTER_TABS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Список задач */}
      {tasksQ.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="rounded-xl border shadow-sm py-0">
          <CardContent className="py-12 text-center">
            <empty.icon className="size-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-medium">{empty.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{empty.hint}</p>
            <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={openCreate}>
              <Plus className="size-3.5" />
              Создать задачу
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="space-y-2.5"
        >
          {tasks.map((t) => (
            <motion.div key={t.id} variants={cardVariants}>
              <TaskCard task={t} currentUserId={currentUserId} onEdit={openEdit} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Диалог создания и редактирования (key реинициализирует форму) */}
      <TaskDialog
        key={`${dialog.task?.id ?? 'new'}-${dialog.nonce}`}
        open={dialog.open}
        onOpenChange={setDialogOpen}
        task={dialog.task}
      />
    </div>
  )
}
