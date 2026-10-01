import { NextResponse } from 'next/server'
import type { Prisma, UserNotification } from '@prisma/client'
import { db } from '@/lib/db'
import { handleApiError, requireUserId } from '@/lib/api-helpers'
import { notificationToDTO } from '@/lib/dto'

export const runtime = 'nodejs'

type TaskWithReminder = Prisma.TaskGetPayload<{ include: { reminder: true } }>

const TWO_MINUTES = 2 * 60 * 1000
const TEN_MINUTES = 10 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// ==================== Вспомогательные функции ====================

/** Разбор "HH:MM" */
function parseTime(time: string): { hh: number; mm: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh > 23 || mm > 59) return null
  return { hh, mm }
}

/**
 * Кандидаты срабатывания для daily/morning/weekly — сегодня и вчера по локальному
 * календарю пользователя (окно может пересекать полночь).
 * Локальное время = UTC + tz минут, поэтому читаем UTC-поля сдвинутого момента.
 */
function calendarOccurrences(
  time: string | null,
  daysOfWeek: string | null,
  now: Date,
  tz: number,
): Date[] {
  if (!time) return []
  const parsed = parseTime(time)
  if (!parsed) return []

  const allowedDays = daysOfWeek
    ? daysOfWeek
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    : null

  const nowLocalMs = now.getTime() + tz * 60000
  const result: Date[] = []
  for (const dayOffset of [0, -1]) {
    const dayLocal = new Date(nowLocalMs + dayOffset * DAY_MS)
    if (allowedDays) {
      const wd = dayLocal.getUTCDay() // 0=Вс..6=Сб по локальному календарю
      const wdIso = wd === 0 ? 7 : wd // 1=Пн..7=Вс
      if (!allowedDays.includes(wdIso)) continue
    }
    const occurrenceMs =
      Date.UTC(
        dayLocal.getUTCFullYear(),
        dayLocal.getUTCMonth(),
        dayLocal.getUTCDate(),
        parsed.hh,
        parsed.mm,
        0,
        0,
      ) - tz * 60000
    result.push(new Date(occurrenceMs))
  }
  return result
}

/** Текст уведомления по типу напоминания */
function reminderNotificationBody(type: string, task: TaskWithReminder): string {
  const base = `«${task.title}»`
  let body: string
  switch (type) {
    case 'at_deadline':
      body = `${base} — срок наступил`
      break
    case 'before':
      body = `${base} — срок на подходе`
      break
    case 'once':
      body = `${base} — запланированное напоминание`
      break
    default:
      body = `${base} — пора действовать`
  }
  if (task.deadline) body += ` (срок: ${task.deadline.toISOString()})`
  return body
}

// ==================== Обработчик ====================

/**
 * Движок напоминаний: находит срабатывания в окне
 * [max(lastFiredAt ?? now-2м, now-10м), now) и создаёт уведомления.
 * tz — смещение локального времени в минутах (как -getTimezoneOffset(), Саратов = 240).
 */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId()

    const tzRaw = Number(new URL(req.url).searchParams.get('tz'))
    const tz = Number.isFinite(tzRaw) ? tzRaw : 0

    // Доступные пользователю задачи (как в GET /api/tasks при scope=all)
    const memberships = await db.familyMember.findMany({
      where: { userId },
      select: { groupId: true },
    })
    const groupIds = memberships.map((m) => m.groupId)

    const orConditions: Prisma.TaskWhereInput[] = [
      { groupId: null, OR: [{ createdById: userId }, { assigneeId: userId }] },
    ]
    if (groupIds.length > 0) orConditions.push({ groupId: { in: groupIds } })

    const tasks = await db.task.findMany({
      where: {
        AND: [{ OR: orConditions }, { status: 'todo' }, { reminder: { enabled: true } }],
      },
      include: { reminder: true },
    })

    const now = new Date()
    const nowMs = now.getTime()
    const fired: UserNotification[] = []

    for (const task of tasks) {
      const reminder = task.reminder
      if (!reminder) continue

      const lastFiredMs = reminder.lastFiredAt ? reminder.lastFiredAt.getTime() : nowMs - TWO_MINUTES
      const windowStart = Math.max(lastFiredMs, nowMs - TEN_MINUTES)
      if (windowStart >= nowMs) continue

      const candidates: Date[] = []
      switch (reminder.type) {
        case 'at_deadline':
          if (task.deadline) candidates.push(task.deadline)
          break
        case 'before':
          if (task.deadline && typeof reminder.offsetMinutes === 'number') {
            candidates.push(new Date(task.deadline.getTime() - reminder.offsetMinutes * 60000))
          }
          break
        case 'daily':
        case 'morning':
          candidates.push(...calendarOccurrences(reminder.time, null, now, tz))
          break
        case 'weekly':
          candidates.push(...calendarOccurrences(reminder.time, reminder.daysOfWeek, now, tz))
          break
        case 'once':
          if (reminder.fireAt) candidates.push(reminder.fireAt)
          break
      }

      const hit = candidates.find((d) => d.getTime() >= windowStart && d.getTime() < nowMs)
      if (!hit) continue

      const notification = await db.userNotification.create({
        data: {
          userId,
          title: 'Напоминание',
          body: reminderNotificationBody(reminder.type, task),
          type: 'reminder',
          taskId: task.id,
        },
      })
      // Помечаем срабатывание, чтобы не дублировать при повторных вызовах;
      // для "once" дополнительно отключаем напоминание
      await db.reminder.update({
        where: { id: reminder.id },
        data:
          reminder.type === 'once'
            ? { lastFiredAt: now, enabled: false }
            : { lastFiredAt: now },
      })
      fired.push(notification)
    }

    return NextResponse.json(fired.map(notificationToDTO))
  } catch (e) {
    return handleApiError(e)
  }
}
