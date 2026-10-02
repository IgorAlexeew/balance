import type { Prisma, Reminder } from '@prisma/client'
import type { ReminderDTO, ReminderType, TaskDTO, TaskPriority, TaskStatus } from '@balance/contracts'
import { parseDaysOfWeek } from '../reminders/schedule'

export const TASK_INCLUDE = { reminder: true, assignee: true, createdBy: true } as const
export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>

function reminderToDTO(r: Reminder): ReminderDTO {
  return {
    type: r.type as ReminderType,
    time: r.time,
    daysOfWeek: parseDaysOfWeek(r.daysOfWeek),
    offsetMinutes: r.offsetMinutes,
    fireAt: r.fireAt?.toISOString() ?? null,
    nextFireAt: r.nextFireAt?.toISOString() ?? null,
  }
}

export function taskToDTO(t: TaskWithRelations): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    deadline: t.deadline?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    createdById: t.createdById,
    createdByName: t.createdBy.name,
    groupId: t.groupId,
    reminder: t.reminder ? reminderToDTO(t.reminder) : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

/** Незавершённые выше, затем по сроку (без срока — в конце), затем новые выше */
export function compareTasks(a: TaskWithRelations, b: TaskWithRelations): number {
  const aDone = a.status === 'done' ? 1 : 0
  const bDone = b.status === 'done' ? 1 : 0
  if (aDone !== bDone) return aDone - bDone
  if (a.deadline && b.deadline && a.deadline.getTime() !== b.deadline.getTime()) {
    return a.deadline.getTime() - b.deadline.getTime()
  }
  if (a.deadline && !b.deadline) return -1
  if (!a.deadline && b.deadline) return 1
  return b.createdAt.getTime() - a.createdAt.getTime()
}
