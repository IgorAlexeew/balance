import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { REMINDER_TYPES, TASK_PRIORITIES } from '@balance/contracts'
import type { ReminderInput, ReminderType, TaskCreateInput, TaskDTO, TaskPriority } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import {
  describeOffset,
  describeWeekdays,
  PRIORITY_LABELS,
  REMINDER_TYPE_LABELS,
  taskApi,
  taskKeys,
} from '@/entities/task'
import { cn } from '@/shared/lib/cn'
import { fmtDateTime, isoToLocalInput, WEEKDAY_FULL, WEEKDAY_SHORT } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'

type ReminderFormType = ReminderType | 'none'

interface ReminderForm {
  type: ReminderFormType
  /** Минуты строкой — значение Select для «заранее» */
  offset: string
  /** HH:MM — для daily/morning/weekly */
  time: string
  /** 1..7 (1 = Пн) — для weekly */
  days: number[]
  /** Значение datetime-local — для once */
  fireAt: string
}

const OFFSET_PRESETS = ['15', '30', '60', '120', '240', '1440', '2880', '10080']
const DEFAULT_OFFSET = '60'
const DEFAULT_TIME: Partial<Record<ReminderFormType, string>> = {
  daily: '09:00',
  morning: '08:00',
  weekly: '18:00',
}

function initReminder(task: TaskDTO | null): ReminderForm {
  const r = task?.reminder ?? null
  const type: ReminderFormType = r?.type ?? 'none'
  return {
    type,
    offset: r?.offsetMinutes != null ? String(r.offsetMinutes) : DEFAULT_OFFSET,
    time: r?.time ?? DEFAULT_TIME[type] ?? '09:00',
    days: r?.daysOfWeek ?? [],
    fireAt: r?.fireAt ? isoToLocalInput(r.fireAt) : '',
  }
}

function reminderHint(r: ReminderForm): string {
  switch (r.type) {
    case 'none':
      return 'Без напоминания'
    case 'at_deadline':
      return 'Напомним в момент наступления срока'
    case 'before':
      return `Напомним за ${describeOffset(Number(r.offset))} до срока`
    case 'daily':
      return `Каждый день в ${r.time || '—'}`
    case 'morning':
      return `Каждое утро в ${r.time || '—'}`
    case 'weekly':
      return r.days.length ? `По ${describeWeekdays(r.days)} в ${r.time || '—'}` : 'Выберите дни недели'
    case 'once':
      return r.fireAt ? `Один раз — ${fmtDateTime(new Date(r.fireAt).toISOString())}` : 'Укажите дату и время'
  }
}

/** Проверка формы напоминания и сборка входа API; строка — текст ошибки */
function buildReminder(r: ReminderForm, hasDeadline: boolean): ReminderInput | null | string {
  switch (r.type) {
    case 'none':
      return null
    case 'at_deadline':
      return hasDeadline ? { type: 'at_deadline' } : 'Для напоминания в срок укажите срок выполнения'
    case 'before':
      return hasDeadline
        ? { type: 'before', offsetMinutes: Number(r.offset) }
        : 'Для напоминания заранее укажите срок выполнения'
    case 'daily':
    case 'morning':
      return r.time ? { type: r.type, time: r.time } : 'Укажите время напоминания'
    case 'weekly':
      if (!r.days.length) return 'Выберите хотя бы один день недели'
      return r.time ? { type: 'weekly', time: r.time, daysOfWeek: r.days } : 'Укажите время напоминания'
    case 'once': {
      if (!r.fireAt) return 'Укажите дату и время напоминания'
      const fireAt = new Date(r.fireAt)
      if (fireAt.getTime() <= Date.now()) return 'Время напоминания должно быть в будущем'
      return { type: 'once', fireAt: fireAt.toISOString() }
    }
  }
}

/**
 * Создание и редактирование задачи. Форма инициализируется при монтировании —
 * родитель пересоздаёт диалог через key при каждом открытии.
 */
export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskDTO | null
}) {
  const queryClient = useQueryClient()
  const { group: activeGroup, groups } = useActiveGroup()
  // Группа задачи при редактировании, иначе — активный контекст
  const groupId = task ? task.groupId : (activeGroup?.id ?? null)
  const members = groups.find((g) => g.id === groupId)?.members ?? []

  const [title, setTitle] = useState(() => task?.title ?? '')
  const [description, setDescription] = useState(() => task?.description ?? '')
  const [deadline, setDeadline] = useState(() => (task?.deadline ? isoToLocalInput(task.deadline) : ''))
  const [priority, setPriority] = useState<TaskPriority>(() => task?.priority ?? 'medium')
  const [assigneeId, setAssigneeId] = useState<string>(() => task?.assigneeId ?? 'none')
  const [reminder, setReminder] = useState<ReminderForm>(() => initReminder(task))

  const save = useMutation({
    mutationFn: (input: TaskCreateInput) => (task ? taskApi.update(task.id, input) : taskApi.create(input)),
    onSuccess: () => {
      toast.success(task ? 'Задача обновлена' : 'Задача создана')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error('Введите название задачи')
      return
    }
    const reminderInput = buildReminder(reminder, Boolean(deadline))
    if (typeof reminderInput === 'string') {
      toast.error(reminderInput)
      return
    }
    save.mutate({
      title: trimmedTitle,
      description: description.trim() || null,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      groupId,
      assigneeId: groupId && assigneeId !== 'none' ? assigneeId : null,
      reminder: reminderInput,
    })
  }

  const setReminderField = <K extends keyof ReminderForm>(key: K, value: ReminderForm[K]) =>
    setReminder((r) => ({ ...r, [key]: value }))

  const offsetOptions = OFFSET_PRESETS.includes(reminder.offset)
    ? OFFSET_PRESETS
    : [reminder.offset, ...OFFSET_PRESETS]

  const assigneeOptions = [
    { value: 'none', label: 'Не назначен' },
    ...members.map((m) => ({ value: m.userId, label: m.name ?? 'Участник' })),
  ]
  if (assigneeId !== 'none' && !members.some((m) => m.userId === assigneeId)) {
    assigneeOptions.push({ value: assigneeId, label: task?.assigneeName ?? 'Исполнитель' })
  }

  const needsDeadline = (reminder.type === 'at_deadline' || reminder.type === 'before') && !deadline
  const showTime = reminder.type === 'daily' || reminder.type === 'morning' || reminder.type === 'weekly'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Редактирование' : 'Новая задача'}</DialogTitle>
          <DialogDescription>
            {groupId ? 'Задача видна всем участникам группы' : 'Личная задача — видна только вам'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="grid gap-4"
        >
          <div className="-mr-1 grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">Название</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Например, оплатить квитанцию"
                autoFocus
              />
            </div>

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

            <div className={cn('grid gap-4', groupId && 'sm:grid-cols-2')}>
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
              {groupId && (
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

            <Separator />
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                <Label htmlFor="task-reminder">Напоминание</Label>
              </div>

              <Select
                value={reminder.type}
                onValueChange={(v) => {
                  const type = v as ReminderFormType
                  setReminder((r) => ({ ...r, type, time: DEFAULT_TIME[type] ?? r.time }))
                }}
              >
                <SelectTrigger id="task-reminder" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без напоминания</SelectItem>
                  {REMINDER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {REMINDER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {reminder.type === 'before' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-reminder-offset" className="text-xs text-muted-foreground">
                    За сколько напомнить
                  </Label>
                  <Select value={reminder.offset} onValueChange={(v) => setReminderField('offset', v)}>
                    <SelectTrigger id="task-reminder-offset" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {offsetOptions.map((o) => (
                        <SelectItem key={o} value={o}>
                          За {describeOffset(Number(o))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {reminder.type === 'weekly' && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Дни недели</Label>
                  <div className="grid grid-cols-7 justify-items-center gap-1">
                    {WEEKDAY_SHORT.map((label, i) => {
                      const day = i + 1
                      const active = reminder.days.includes(day)
                      return (
                        <Button
                          key={day}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="icon"
                          aria-pressed={active}
                          aria-label={WEEKDAY_FULL[i]}
                          className="rounded-lg text-xs"
                          onClick={() =>
                            setReminderField(
                              'days',
                              active ? reminder.days.filter((d) => d !== day) : [...reminder.days, day],
                            )
                          }
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              {showTime && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-reminder-time" className="text-xs text-muted-foreground">
                    Время
                  </Label>
                  <Input
                    id="task-reminder-time"
                    type="time"
                    value={reminder.time}
                    onChange={(e) => setReminderField('time', e.target.value)}
                  />
                </div>
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
                    onChange={(e) => setReminderField('fireAt', e.target.value)}
                  />
                </div>
              )}

              {needsDeadline && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Укажите срок выполнения выше</p>
              )}
              {reminder.type !== 'none' && (
                <p className="text-xs text-muted-foreground">{reminderHint(reminder)}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {task ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
