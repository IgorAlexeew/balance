import { formatInTimeZone } from 'date-fns-tz'
import { ru } from 'date-fns/locale'
import { prisma } from '../../db'
import { purgeExpiredSessions } from '../auth/sessions'
import { computeNextFireAt } from './schedule'

const BATCH_SIZE = 200

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
export async function processDueReminders(now = new Date()): Promise<number> {
  const due = await prisma.reminder.findMany({
    where: { nextFireAt: { lte: now }, task: { status: 'todo' } },
    include: { task: { include: { assignee: true, createdBy: true } } },
    orderBy: { nextFireAt: 'asc' },
    take: BATCH_SIZE,
  })

  let fired = 0
  for (const reminder of due) {
    const { task } = reminder
    const recipient = task.assignee ?? task.createdBy
    const next = computeNextFireAt(reminder, { deadline: task.deadline, timezone: recipient.timezone, after: now })

    let body = `«${task.title}» — ${BODY_BY_TYPE[reminder.type] ?? 'пора действовать'}`
    if (task.deadline) {
      body += ` (срок: ${formatInTimeZone(task.deadline, recipient.timezone, 'd MMMM, HH:mm', { locale: ru })})`
    }

    const claimed = await prisma.$transaction(async (tx) => {
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

/** Запускает фоновый цикл напоминаний; возвращает функцию остановки */
export function startReminderScheduler(intervalMs: number): () => void {
  let running = false
  let ticks = 0
  const tick = async () => {
    if (running) return
    running = true
    try {
      await processDueReminders()
      // Раз в ~час чистим просроченные сессии
      if (ticks++ % Math.max(1, Math.round(3_600_000 / intervalMs)) === 0) await purgeExpiredSessions()
    } catch (e) {
      console.error('[reminders] tick failed', e)
    } finally {
      running = false
    }
  }
  void tick()
  const timer = setInterval(tick, intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
