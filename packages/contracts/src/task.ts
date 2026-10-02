import { z } from 'zod'
import { groupRefSchema, idSchema, isoDateTimeSchema, optionalText, requiredText } from './common'
import { TASK_FILTERS, TASK_PRIORITIES, TASK_STATUSES } from './enums'
import type { TaskPriority, TaskStatus } from './enums'
import { reminderInputSchema, type ReminderDTO } from './reminder'

const nullableRef = idSchema
  .nullish()
  .or(z.literal(''))
  .transform((v) => (v === undefined ? undefined : v || null))

const taskFields = {
  title: requiredText(200, 'Название'),
  description: optionalText(2000),
  status: z.enum(TASK_STATUSES, { error: 'Некорректный статус' }),
  priority: z.enum(TASK_PRIORITIES, { error: 'Некорректный приоритет' }),
  deadline: isoDateTimeSchema.nullish(),
  groupId: groupRefSchema,
  assigneeId: nullableRef,
  /** null — снять напоминание */
  reminder: reminderInputSchema.nullish(),
}

export const taskCreateSchema = z.object({
  ...taskFields,
  status: taskFields.status.default('todo'),
  priority: taskFields.priority.default('medium'),
})
export type TaskCreateInput = z.input<typeof taskCreateSchema>

export const taskUpdateSchema = z.object({
  title: taskFields.title.optional(),
  description: taskFields.description,
  status: taskFields.status.optional(),
  priority: taskFields.priority.optional(),
  deadline: taskFields.deadline,
  groupId: taskFields.groupId,
  assigneeId: taskFields.assigneeId,
  reminder: taskFields.reminder,
})
export type TaskUpdateInput = z.input<typeof taskUpdateSchema>

/** scope: personal — личные, all — все доступные, иначе id группы */
export const taskListQuerySchema = z.object({
  status: z.enum(TASK_FILTERS).default('all'),
  scope: z.union([z.literal('personal'), z.literal('all'), idSchema]).default('personal'),
})
export type TaskListQuery = z.input<typeof taskListQuerySchema>

export interface TaskDTO {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  deadline: string | null
  completedAt: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdById: string
  createdByName: string | null
  groupId: string | null
  reminder: ReminderDTO | null
  createdAt: string
  updatedAt: string
}
