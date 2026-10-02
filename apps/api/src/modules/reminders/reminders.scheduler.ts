import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { formatInTimeZone } from 'date-fns-tz'
import { ru } from 'date-fns/locale'
import { PrismaService } from '../../prisma/prisma.service'
import { computeNextFireAt } from './schedule'

const BATCH_SIZE = 200
const TICK_MS = 30_000

const BODY_BY_TYPE: Record<string, string> = {
  at_deadline: 'срок наступил',
  before: 'скоро срок',
  once: 'запланированное напоминание',
}

/**
 * Обрабатывает напоминания, срок которых наступил: создаёт уведомление получателю
 * и сдвигает nextFireAt. Захват напоминания атомарный (updateMany по старому
 * nextFireAt), поэтому параллельные тики и несколько инстансов не дублируют уведомления.
 */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name)
  private running = false

  constructor(private readonly prisma: PrismaService) {}

  /** Срабатывает только при подключённом ScheduleModule (в тестах выключен) */
  @Interval('reminders', TICK_MS)
  async tick(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      await this.processDue()
    } catch (e) {
      this.logger.error(`Reminders tick failed: ${String(e)}`)
    } finally {
      this.running = false
    }
  }

  async processDue(now = new Date()): Promise<number> {
    const due = await this.prisma.reminder.findMany({
      where: { nextFireAt: { lte: now }, task: { status: 'todo' } },
      include: { task: { include: { assignee: true, createdBy: true } } },
      orderBy: { nextFireAt: 'asc' },
      take: BATCH_SIZE,
    })

    let fired = 0
    for (const reminder of due) {
      const { task } = reminder
      const recipient = task.assignee ?? task.createdBy
      const next = computeNextFireAt(reminder, {
        deadline: task.deadline,
        timezone: recipient.timezone,
        after: now,
      })

      let body = `«${task.title}» — ${BODY_BY_TYPE[reminder.type] ?? 'пора действовать'}`
      if (task.deadline) {
        body += ` (срок: ${formatInTimeZone(task.deadline, recipient.timezone, 'd MMMM, HH:mm', { locale: ru })})`
      }

      const claimed = await this.prisma.$transaction(async (tx) => {
        const res = await tx.reminder.updateMany({
          where: { id: reminder.id, nextFireAt: reminder.nextFireAt },
          data: { nextFireAt: next, lastFiredAt: now },
        })
        if (res.count === 0) return false
        await tx.userNotification.create({
          data: { userId: recipient.id, title: 'Напоминание', body, type: 'reminder', taskId: task.id },
        })
        return true
      })
      if (claimed) fired++
    }
    return fired
  }
}
