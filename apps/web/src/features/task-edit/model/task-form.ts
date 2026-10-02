import { z } from 'zod'
import { REMINDER_TYPES, TASK_PRIORITIES } from '@balance/contracts'
import type { ReminderInput, TaskCreateInput, TaskDTO } from '@balance/contracts'
import { isoToLocalInput } from '@/shared/lib/format'

export const NO_REMINDER = 'none'
export const NO_ASSIGNEE = 'none'
export const DEFAULT_TIME: Partial<Record<string, string>> = {
  daily: '09:00',
  morning: '08:00',
  weekly: '18:00',
}

/** Форма задачи: значения в формате полей ввода, проверка правил напоминания */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Введите название задачи').max(200),
    description: z.string().max(2000),
    /** yyyy-MM-ddTHH:mm или '' */
    deadline: z.string(),
    priority: z.enum(TASK_PRIORITIES),
    assigneeId: z.string(),
    reminder: z.object({
      type: z.enum([NO_REMINDER, ...REMINDER_TYPES]),
      offset: z.string(),
      time: z.string(),
      days: z.array(z.number().int().min(1).max(7)),
      fireAt: z.string(),
    }),
  })
  .superRefine((v, ctx) => {
    const r = v.reminder
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: ['reminder', path], message })
    if ((r.type === 'at_deadline' || r.type === 'before') && !v.deadline) {
      ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Для этого напоминания нужен срок' })
    }
    if ((r.type === 'daily' || r.type === 'morning' || r.type === 'weekly') && !r.time) {
      issue('time', 'Укажите время напоминания')
    }
    if (r.type === 'weekly' && r.days.length === 0) issue('days', 'Выберите хотя бы один день недели')
    if (r.type === 'once') {
      if (!r.fireAt) issue('fireAt', 'Укажите дату и время напоминания')
      else if (new Date(r.fireAt).getTime() <= Date.now())
        issue('fireAt', 'Время напоминания должно быть в будущем')
    }
  })

export type TaskFormValues = z.infer<typeof taskFormSchema>

export function taskFormDefaults(task: TaskDTO | null): TaskFormValues {
  const r = task?.reminder ?? null
  const type = r?.type ?? NO_REMINDER
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    deadline: task?.deadline ? isoToLocalInput(task.deadline) : '',
    priority: task?.priority ?? 'medium',
    assigneeId: task?.assigneeId ?? NO_ASSIGNEE,
    reminder: {
      type,
      offset: r?.offsetMinutes != null ? String(r.offsetMinutes) : '60',
      time: r?.time ?? DEFAULT_TIME[type] ?? '09:00',
      days: r?.daysOfWeek ?? [],
      fireAt: r?.fireAt ? isoToLocalInput(r.fireAt) : '',
    },
  }
}

function toReminderInput(r: TaskFormValues['reminder']): ReminderInput | null {
  switch (r.type) {
    case NO_REMINDER:
      return null
    case 'at_deadline':
      return { type: 'at_deadline' }
    case 'before':
      return { type: 'before', offsetMinutes: Number(r.offset) }
    case 'daily':
    case 'morning':
      return { type: r.type, time: r.time }
    case 'weekly':
      return { type: 'weekly', time: r.time, daysOfWeek: r.days }
    case 'once':
      return { type: 'once', fireAt: new Date(r.fireAt).toISOString() }
  }
}

export function toTaskInput(v: TaskFormValues, groupId: string | null): TaskCreateInput {
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    priority: v.priority,
    deadline: v.deadline ? new Date(v.deadline).toISOString() : null,
    groupId,
    assigneeId: groupId && v.assigneeId !== NO_ASSIGNEE ? v.assigneeId : null,
    reminder: toReminderInput(v.reminder),
  }
}
