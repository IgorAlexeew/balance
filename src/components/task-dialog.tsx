'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { BellRing, Loader2, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { fmtDateTime, PRIORITY_LABELS, plural, WEEKDAY_LABELS } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import { TASK_PRIORITIES } from '@/lib/types'
import type { ReminderType, TaskDTO, TaskInput, TaskPriority } from '@/lib/types'

// ===== Типы и константы =====

type ReminderFormType = ReminderType | 'none'

interface ReminderForm {
  type: ReminderFormType
  /** Значение Select с пресетами офсетов (в минутах, строкой) — для before */
  offset: string
  /** "HH:MM" — для daily/morning/weekly */
  time: string
  /** Выбранные дни недели 1..7 (1 = Пн) — для weekly */
  days: number[]
  /** Значение datetime-local — для once */
  fireAt: string
}

const REMINDER_OPTIONS: { value: ReminderFormType; label: string }[] = [
  { value: 'none', label: 'Без напоминания' },
  { value: 'at_deadline', label: 'В момент срока' },
  { value: 'before', label: 'Заранее до срока' },
  { value: 'daily', label: 'Каждый день в…' },
  { value: 'morning', label: 'Каждое утро в…' },
  { value: 'weekly', label: 'По дням недели' },
  { value: 'once', label: 'Один раз' },
]

const OFFSET_PRESETS: { value: string; label: string }[] = [
  { value: '15', label: 'За 15 минут' },
  { value: '30', label: 'За 30 минут' },
  { value: '60', label: 'За час' },
  { value: '120', label: 'За 2 часа' },
  { value: '240', label: 'За 4 часа' },
  { value: '1440', label: 'За день' },
  { value: '2880', label: 'За 2 дня' },
  { value: '10080', label: 'За неделю' },
]

const DEFAULT_OFFSET = '60'

const DEFAULT_TIME: Partial<Record<ReminderFormType, string>> = {
  daily: '09:00',
  morning: '08:00',
  weekly: '18:00',
}

const WEEKDAYS_FULL = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
]

// ===== Хелперы =====

/** ISO → значение для <Input type="datetime-local"> в локальной зоне */
function isoToLocalInput(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

/** «1 день» / «2 часа» / «45 минут» — без предлога */
function describeOffset(minutes: number): string {
  if (minutes % 1440 === 0 && minutes >= 1440) {
    const days = minutes / 1440
    return `${days} ${plural(days, 'день', 'дня', 'дней')}`
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60
    return `${hours} ${plural(hours, 'час', 'часа', 'часов')}`
  }
  return `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')}`
}

/** Начальное состояние формы напоминания из задачи (или дефолты) */
function initReminder(task: TaskDTO | null): ReminderForm {
  const r = task?.reminder && task.reminder.enabled ? task.reminder : null
  const type = (r?.type ?? 'none') as ReminderFormType
  return {
    type,
    offset: r?.offsetMinutes != null ? String(r.offsetMinutes) : DEFAULT_OFFSET,
    time: r?.time ?? DEFAULT_TIME[type] ?? '09:00',
    days: r?.daysOfWeek
      ? r.daysOfWeek
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      : [],
    fireAt: r?.fireAt ? isoToLocalInput(r.fireAt) : '',
  }
}

/** Live-подсказка текущей конфигурации напоминания */
function reminderHint(r: ReminderForm): string {
  switch (r.type) {
    case 'none':
      return 'Без напоминания'
    case 'at_deadline':
      return 'Напомним в момент наступления срока'
    case 'before':
      return r.offset
        ? `Напомним за ${describeOffset(Number(r.offset))} до срока`
        : 'Выберите, за сколько напомнить'
    case 'daily':
      return r.time ? `Каждый день в ${r.time}` : 'Укажите время напоминания'
    case 'morning':
      return r.time ? `Каждое утро в ${r.time}` : 'Укажите время напоминания'
    case 'weekly': {
      if (r.days.length === 0) return 'Выберите дни недели'
      const labels = [...r.days]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d - 1] ?? '')
        .filter(Boolean)
        .join(', ')
      return r.time ? `По ${labels} в ${r.time}` : `По ${labels} — укажите время`
    }
    case 'once':
      return r.fireAt
        ? `Один раз — ${fmtDateTime(new Date(r.fireAt).toISOString())}`
        : 'Укажите дату и время напоминания'
  }
}

// ===== Компонент =====

export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  task: TaskDTO | null
}) {
  const queryClient = useQueryClient()
  const groupId = useAppStore((s) => s.groupId)
  const isGroup = groupId !== null

  // Состояние формы: инициализируется при монтировании.
  // Родитель реинициализирует диалог через key при каждом открытии.
  const [title, setTitle] = useState(() => task?.title ?? '')
  const [description, setDescription] = useState(() => task?.description ?? '')
  const [deadline, setDeadline] = useState(() => (task?.deadline ? isoToLocalInput(task.deadline) : ''))
  const [priority, setPriority] = useState<TaskPriority>(() => task?.priority ?? 'medium')
  const [assigneeId, setAssigneeId] = useState<'none' | string>(() => task?.assigneeId ?? 'none')
  const [reminder, setReminder] = useState<ReminderForm>(() => initReminder(task))

  // Члены активной группы — для выбора исполнителя (только в групповом контексте)
  const membersQ = useQuery({
    queryKey: ['family'],
    queryFn: api.family.list,
    enabled: isGroup,
  })
  const members = isGroup ? membersQ.data?.find((g) => g.id === groupId)?.members ?? [] : []

  const save = useMutation({
    mutationFn: (input: TaskInput) =>
      task ? api.tasks.update(task.id, input) : api.tasks.create(input),
    onSuccess: () => {
      toast.success(task ? 'Задача обновлена' : 'Задача создана')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: Error) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error('Задача не найдена')
      return api.tasks.remove(task.id)
    },
    onSuccess: () => {
      toast.success('Задача удалена')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: Error) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const changeReminderType = (type: ReminderFormType) => {
    setReminder((r) => ({ ...r, type, time: DEFAULT_TIME[type] ?? r.time }))
  }

  const toggleDay = (day: number) => {
    setReminder((r) => ({
      ...r,
      days: r.days.includes(day) ? r.days.filter((d) => d !== day) : [...r.days, day],
    }))
  }

  const handleSubmit = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error('Введите название задачи')
      return
    }
    if (reminder.type === 'at_deadline' && !deadline) {
      toast.error('Для напоминания в срок укажите срок выполнения')
      return
    }
    if (reminder.type === 'before') {
      if (!deadline) {
        toast.error('Для напоминания заранее укажите срок выполнения')
        return
      }
      if (!reminder.offset) {
        toast.error('Укажите, за сколько времени напомнить')
        return
      }
    }
    if ((reminder.type === 'daily' || reminder.type === 'morning') && !reminder.time) {
      toast.error('Укажите время напоминания')
      return
    }
    if (reminder.type === 'weekly') {
      if (reminder.days.length === 0) {
        toast.error('Выберите хотя бы один день недели')
        return
      }
      if (!reminder.time) {
        toast.error('Укажите время напоминания')
        return
      }
    }
    if (reminder.type === 'once') {
      if (!reminder.fireAt) {
        toast.error('Укажите дату и время напоминания')
        return
      }
      if (new Date(reminder.fireAt).getTime() <= Date.now()) {
        toast.error('Время напоминания должно быть в будущем')
        return
      }
    }

    const input: TaskInput = {
      title: trimmedTitle,
      description: description.trim() || null,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      assigneeId: isGroup && assigneeId !== 'none' ? assigneeId : null,
      groupId,
      reminder:
        reminder.type === 'none'
          ? null
          : {
              type: reminder.type,
              time:
                reminder.type === 'daily' || reminder.type === 'morning' || reminder.type === 'weekly'
                  ? reminder.time || null
                  : null,
              daysOfWeek:
                reminder.type === 'weekly' && reminder.days.length > 0
                  ? [...reminder.days].sort((a, b) => a - b).join(',')
                  : null,
              offsetMinutes: reminder.type === 'before' ? Number(reminder.offset) : null,
              fireAt:
                reminder.type === 'once' && reminder.fireAt
                  ? new Date(reminder.fireAt).toISOString()
                  : null,
            },
    }
    save.mutate(input)
  }

  // Пресеты офсетов: если у задачи нестандартный офсет — добавляем его в список
  const offsetOptions = OFFSET_PRESETS.some((p) => p.value === reminder.offset)
    ? OFFSET_PRESETS
    : [{ value: reminder.offset, label: `За ${describeOffset(Number(reminder.offset))}` }, ...OFFSET_PRESETS]

  // Опции исполнителя: «Не назначен» + члены группы (плюс текущий, если он уже не в группе)
  const assigneeOptions: { value: string; label: string }[] = [
    { value: 'none', label: 'Не назначен' },
    ...members.map((m) => ({ value: m.userId, label: m.name ?? 'Участник' })),
  ]
  if (assigneeId !== 'none' && !members.some((m) => m.userId === assigneeId)) {
    assigneeOptions.push({ value: assigneeId, label: task?.assigneeName ?? 'Исполнитель' })
  }

  const needsDeadline =
    (reminder.type === 'at_deadline' || reminder.type === 'before') && !deadline

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Редактирование' : 'Новая задача'}</DialogTitle>
          <DialogDescription className="sr-only">
            Заполните параметры задачи и настройте напоминание
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="grid gap-4"
        >
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
            {/* Название */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">Название</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Например, оплатить квитанцию"
              />
            </div>

            {/* Описание */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-description">Описание</Label>
              <Textarea
                id="task-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder="Необязательно"
              />
            </div>

            {/* Срок */}
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="task-deadline">Срок</Label>
                <span className="text-[11px] text-muted-foreground">Необязательно</span>
              </div>
              <Input
                id="task-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Приоритет и исполнитель */}
            <div className={cn('grid gap-4', isGroup && 'sm:grid-cols-2')}>
              <div className="grid gap-1.5">
                <Label htmlFor="task-priority">Приоритет</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger id="task-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isGroup && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-assignee">Исполнитель</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger id="task-assignee" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assigneeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Напоминание */}
            <Separator />
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                <Label htmlFor="task-reminder">Напоминание</Label>
              </div>

              <Select value={reminder.type} onValueChange={(v) => changeReminderType(v as ReminderFormType)}>
                <SelectTrigger id="task-reminder" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {reminder.type === 'before' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-reminder-offset" className="text-xs text-muted-foreground">
                    За сколько напомнить
                  </Label>
                  <Select
                    value={reminder.offset}
                    onValueChange={(v) => setReminder((r) => ({ ...r, offset: v }))}
                  >
                    <SelectTrigger id="task-reminder-offset" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {offsetOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(reminder.type === 'daily' || reminder.type === 'morning') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-reminder-time" className="text-xs text-muted-foreground">
                    Время
                  </Label>
                  <Input
                    id="task-reminder-time"
                    type="time"
                    value={reminder.time}
                    onChange={(e) => setReminder((r) => ({ ...r, time: e.target.value }))}
                  />
                </div>
              )}

              {reminder.type === 'weekly' && (
                <>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Дни недели</Label>
                    <div className="grid grid-cols-7 gap-1 justify-items-center">
                      {WEEKDAY_LABELS.map((label, i) => {
                        const day = i + 1
                        const active = reminder.days.includes(day)
                        return (
                          <Button
                            key={day}
                            type="button"
                            variant={active ? 'default' : 'outline'}
                            size="icon"
                            aria-pressed={active}
                            aria-label={WEEKDAYS_FULL[i]}
                            className="rounded-lg text-xs"
                            onClick={() => toggleDay(day)}
                          >
                            {label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="task-reminder-time" className="text-xs text-muted-foreground">
                      Время
                    </Label>
                    <Input
                      id="task-reminder-time"
                      type="time"
                      value={reminder.time}
                      onChange={(e) => setReminder((r) => ({ ...r, time: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {reminder.type === 'once' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-reminder-fire-at" className="text-xs text-muted-foreground">
                    Дата и время
                  </Label>
                  <Input
                    id="task-reminder-fire-at"
                    type="datetime-local"
                    value={reminder.fireAt}
                    onChange={(e) => setReminder((r) => ({ ...r, fireAt: e.target.value }))}
                  />
                </div>
              )}

              {needsDeadline && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Укажите срок выполнения выше
                </p>
              )}

              {reminder.type !== 'none' && (
                <p className="text-xs text-muted-foreground">{reminderHint(reminder)}</p>
              )}
            </div>
          </div>

          <DialogFooter className={task ? 'sm:justify-between' : undefined}>
            {task && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive gap-1.5"
                    disabled={save.isPending || remove.isPending}
                  >
                    {remove.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Удалить
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
                      disabled={remove.isPending}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                Отмена
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="size-4 animate-spin" />}
                {task ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
