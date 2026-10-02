import type { Prisma } from '@prisma/client'
import type { ReminderInput } from '@balance/contracts'
import { prisma } from '../../db'
import { computeNextFireAt } from './schedule'

type Tx = Prisma.TransactionClient

/** Данные напоминания для БД из провалидированного входа */
export function reminderData(input: ReminderInput) {
  return {
    type: input.type,
    time: 'time' in input ? input.time : null,
    daysOfWeek: input.type === 'weekly' ? [...new Set(input.daysOfWeek)].sort((a, b) => a - b).join(',') : null,
    offsetMinutes: input.type === 'before' ? input.offsetMinutes : null,
    fireAt: input.type === 'once' ? new Date(input.fireAt) : null,
  }
}

/** Получатель напоминания: исполнитель, а если его нет — автор задачи */
export function reminderRecipientId(task: { assigneeId: string | null; createdById: string }): string {
  return task.assigneeId ?? task.createdById
}

/** Пересчитывает nextFireAt напоминания задачи (после изменения задачи или зоны) */
export async function rescheduleTaskReminder(taskId: string, db: Tx | typeof prisma = prisma): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { reminder: true, assignee: true, createdBy: true },
  })
  if (!task?.reminder) return
  const recipient = task.assignee ?? task.createdBy
  const nextFireAt = computeNextFireAt(task.reminder, {
    deadline: task.deadline,
    timezone: recipient.timezone,
    after: new Date(),
  })
  await db.reminder.update({ where: { id: task.reminder.id }, data: { nextFireAt } })
}

export async function rescheduleRemindersForUser(userId: string): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: {
      reminder: { isNot: null },
      OR: [{ assigneeId: userId }, { assigneeId: null, createdById: userId }],
    },
    select: { id: true },
  })
  for (const t of tasks) await rescheduleTaskReminder(t.id)
}
