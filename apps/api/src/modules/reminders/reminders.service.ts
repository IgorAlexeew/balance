import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { type Db, rescheduleTaskReminder } from './reminder-data'

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  rescheduleTask(taskId: string, db: Db = this.prisma): Promise<void> {
    return rescheduleTaskReminder(db, taskId)
  }

  /** После смены часового пояса пользователя пересчитываем его напоминания */
  async rescheduleForUser(userId: string): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: {
        reminder: { isNot: null },
        OR: [{ assigneeId: userId }, { assigneeId: null, createdById: userId }],
      },
      select: { id: true },
    })
    for (const t of tasks) await rescheduleTaskReminder(this.prisma, t.id)
  }
}
