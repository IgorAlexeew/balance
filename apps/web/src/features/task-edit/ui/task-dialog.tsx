import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { BellRing } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { REMINDER_TYPES, TASK_PRIORITIES } from '@balance/contracts'
import type { TaskCreateInput, TaskDTO, TaskPriority } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import {
  describeOffset,
  describeWeekdays,
  PRIORITY_LABELS,
  REMINDER_TYPE_LABELS,
  taskApi,
  taskKeys,
} from '@/entities/task'
import { fmtDateTime, WEEKDAY_FULL, WEEKDAY_SHORT } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { DateTimePicker } from '@/shared/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spinner } from '@/shared/ui/spinner'
import { Textarea } from '@/shared/ui/textarea'
import {
  DEFAULT_TIME,
  NO_ASSIGNEE,
  NO_REMINDER,
  taskFormDefaults,
  taskFormSchema,
  toTaskInput,
  type TaskFormValues,
} from '../model/task-form'

const OFFSET_PRESETS = ['15', '30', '60', '120', '240', '1440', '2880', '10080']

function reminderHint(r: TaskFormValues['reminder']): string | null {
  switch (r.type) {
    case 'at_deadline':
      return 'Напомним в момент наступления срока'
    case 'before':
      return `Напомним за ${describeOffset(Number(r.offset))} до срока`
    case 'weekly':
      return r.days.length && r.time ? `По ${describeWeekdays(r.days)} в ${r.time}` : null
    case 'once':
      return r.fireAt ? `Один раз — ${fmtDateTime(new Date(r.fireAt).toISOString())}` : null
    default:
      return null
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

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: taskFormDefaults(task),
  })
  const reminder = useWatch({ control: form.control, name: 'reminder' })
  const assigneeId = useWatch({ control: form.control, name: 'assigneeId' })

  const save = useMutation({
    mutationFn: (input: TaskCreateInput) => (task ? taskApi.update(task.id, input) : taskApi.create(input)),
    onSuccess: () => {
      toast.success(task ? 'Задача обновлена' : 'Задача создана')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const offsetOptions = OFFSET_PRESETS.includes(reminder.offset)
    ? OFFSET_PRESETS
    : [reminder.offset, ...OFFSET_PRESETS]
  const assigneeOptions = [
    { value: NO_ASSIGNEE, label: 'Не назначен' },
    ...members.map((m) => ({ value: m.userId, label: m.name ?? 'Участник' })),
  ]
  if (assigneeId !== NO_ASSIGNEE && !members.some((m) => m.userId === assigneeId)) {
    assigneeOptions.push({ value: assigneeId, label: task?.assigneeName ?? 'Исполнитель' })
  }
  const showTime = reminder.type === 'daily' || reminder.type === 'morning' || reminder.type === 'weekly'
  const hint = reminderHint(reminder)

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
          noValidate
          onSubmit={form.handleSubmit((v) => save.mutate(toTaskInput(v, groupId)))}
          className="grid gap-4"
        >
          <FieldGroup className="-mr-1 max-h-[60vh] gap-4 overflow-y-auto pr-1">
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="task-title">Название</FieldLabel>
                  <Input
                    {...field}
                    id="task-title"
                    maxLength={200}
                    placeholder="Например, оплатить квитанцию"
                    aria-invalid={fieldState.invalid}
                    autoFocus
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="task-description">Описание</FieldLabel>
                  <Textarea
                    {...field}
                    id="task-description"
                    rows={2}
                    maxLength={2000}
                    placeholder="Необязательно"
                  />
                </Field>
              )}
            />

            <Controller
              name="deadline"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="task-deadline">Срок</FieldLabel>
                  <DateTimePicker
                    id="task-deadline"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Без срока"
                    defaultTime="18:00"
                    invalid={fieldState.invalid}
                    clearable
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className={groupId ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="task-priority">Приоритет</FieldLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as TaskPriority)}>
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
                  </Field>
                )}
              />
              {groupId && (
                <Controller
                  name="assigneeId"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="task-assignee">Исполнитель</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
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
                      <FieldDescription>Напоминание придёт исполнителю</FieldDescription>
                    </Field>
                  )}
                />
              )}
            </div>

            <FieldSeparator />

            <Controller
              name="reminder.type"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="task-reminder">
                    <BellRing className="size-4 text-primary" />
                    Напоминание
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      const time = DEFAULT_TIME[v]
                      if (time) form.setValue('reminder.time', time)
                    }}
                  >
                    <SelectTrigger id="task-reminder" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_REMINDER}>Без напоминания</SelectItem>
                      {REMINDER_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {REMINDER_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hint && <FieldDescription>{hint}</FieldDescription>}
                </Field>
              )}
            />

            {reminder.type === 'before' && (
              <Controller
                name="reminder.offset"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="task-reminder-offset">За сколько напомнить</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                  </Field>
                )}
              />
            )}

            {reminder.type === 'weekly' && (
              <Controller
                name="reminder.days"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Дни недели</FieldLabel>
                    <div className="grid grid-cols-7 justify-items-center gap-1">
                      {WEEKDAY_SHORT.map((label, i) => {
                        const day = i + 1
                        const active = field.value.includes(day)
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
                              field.onChange(
                                active ? field.value.filter((d) => d !== day) : [...field.value, day],
                              )
                            }
                          >
                            {label}
                          </Button>
                        )
                      })}
                    </div>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            {showTime && (
              <Controller
                name="reminder.time"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="task-reminder-time">Время</FieldLabel>
                    <Input {...field} id="task-reminder-time" type="time" aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            {reminder.type === 'once' && (
              <Controller
                name="reminder.fireAt"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="task-reminder-fire-at">Когда напомнить</FieldLabel>
                    <DateTimePicker
                      id="task-reminder-fire-at"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}
          </FieldGroup>

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
              {save.isPending && <Spinner />}
              {task ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
