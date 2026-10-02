import type { Prisma, PrismaClient } from '@prisma/client'
import type { ReminderInput } from '@balance/contracts'
import { computeNextFireAt } from './schedule'

export type Db = PrismaClient | Prisma.TransactionClient

/** Данные напоминания для БД из провалидированного входа */
export function reminderData(input: ReminderInput) {
  return {
    type: input.type,
    time: 'time' in input ? input.time : null,
    daysOfWeek:
      input.type === 'weekly' ? [...new Set(input.daysOfWeek)].sort((a, b) => a - b).join(',') : null,
    offsetMinutes: input.type === 'before' ? input.offsetMinutes : null,
    fireAt: input.type === 'once' ? new Date(input.fireAt) : null,
  }
}

/**
 * Пересчитывает nextFireAt напоминания задачи. Получатель — исполнитель,
 * а если его нет — автор; ежедневные напоминания считаются в его часовом поясе.
 */
export async function rescheduleTaskReminder(db: Db, taskId: string): Promise<void> {
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
