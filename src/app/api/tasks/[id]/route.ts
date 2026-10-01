import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  ApiError,
  assertGroupAccess,
  handleApiError,
  optString,
  parseIsoDate,
  reqString,
  requireUserId,
} from '@/lib/api-helpers'
import { taskToDTO } from '@/lib/dto'
import type { TaskWithRelations } from '@/lib/dto'
import { REMINDER_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/types'

export const runtime = 'nodejs'

const TASK_INCLUDE = { reminder: true, assignee: true, createdBy: true } as const
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// ==================== Вспомогательные функции ====================

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    throw new ApiError(400, 'Некорректное тело запроса')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'Некорректное тело запроса')
  }
  return parsed as Record<string, unknown>
}

/** Необязательное enum-поле: отсутствует/пустое -> undefined, иначе значение из allowed либо 400 */
function optEnumField<T extends string>(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T | undefined {
  const v = body[field]
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new ApiError(400, `Некорректное значение поля «${field}»`)
  }
  return v as T
}

/** Необязательный дедлайн: отсутствует -> undefined, null/пустое -> null, иначе Date либо 400 */
function optDeadline(body: Record<string, unknown>): Date | null | undefined {
  const v = body['deadline']
  if (v === undefined || v === '') return undefined
  if (v === null) return null
  return parseIsoDate(v, 'deadline')
}

/** Парсит дни недели "1,3,5" (или массив) -> нормализованная строка "1,3,5" (1=Пн..7=Вс) */
function parseDaysOfWeek(value: unknown): string {
  const parts: string[] = Array.isArray(value)
    ? value.map((v) => String(v))
    : typeof value === 'string'
      ? value.split(',')
      : []
  const days = new Set<number>()
  for (const part of parts) {
    const n = Number(part.trim())
    if (!Number.isInteger(n) || n < 1 || n > 7) throw new ApiError(400, 'Выберите дни недели')
    days.add(n)
  }
  if (days.size === 0) throw new ApiError(400, 'Выберите дни недели')
  return [...days].sort((a, b) => a - b).join(',')
}

/** Валидация напоминания из body -> данные для nested create */
function validateReminderInput(
  input: Record<string, unknown>,
  deadline: Date | null,
): Prisma.ReminderUncheckedCreateWithoutTaskInput {
  const type = input['type']
  if (typeof type !== 'string' || !(REMINDER_TYPES as string[]).includes(type)) {
    throw new ApiError(400, 'Выберите тип напоминания')
  }
  const data: Prisma.ReminderUncheckedCreateWithoutTaskInput = { type, enabled: true }

  if (type === 'at_deadline') {
    if (!deadline) throw new ApiError(400, 'Для напоминания в срок нужен срок выполнения')
  } else if (type === 'before') {
    if (!deadline) throw new ApiError(400, 'Для напоминания заранее нужен срок выполнения')
    const raw = input['offsetMinutes']
    const n = typeof raw === 'string' ? Number(raw) : raw
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 43200) {
      throw new ApiError(400, 'Укажите, за сколько минут напомнить (целое от 1 до 43200)')
    }
    data.offsetMinutes = n
  } else if (type === 'daily' || type === 'morning') {
    const time = input['time']
    if (typeof time !== 'string' || !TIME_RE.test(time)) {
      throw new ApiError(400, 'Укажите время напоминания')
    }
    data.time = time
  } else if (type === 'weekly') {
    const time = input['time']
    if (typeof time !== 'string' || !TIME_RE.test(time)) {
      throw new ApiError(400, 'Укажите время напоминания')
    }
    data.time = time
    data.daysOfWeek = parseDaysOfWeek(input['daysOfWeek'])
  } else {
    // once
    const fireAt = input['fireAt'] ? parseIsoDate(input['fireAt'], 'fireAt') : null
    if (!fireAt || fireAt.getTime() <= Date.now()) {
      throw new ApiError(400, 'Время напоминания должно быть в будущем')
    }
    data.fireAt = fireAt
  }
  return data
}

/**
 * Доступ к задаче: создатель, назначенный исполнитель или член группы задачи.
 * Иначе 404 — не раскрываем существование чужих задач.
 */
async function getAccessibleTask(userId: string, id: string): Promise<TaskWithRelations> {
  const task = await db.task.findUnique({ where: { id }, include: TASK_INCLUDE })
  if (!task) throw new ApiError(404, 'Задача не найдена')
  if (task.createdById === userId || task.assigneeId === userId) return task
  if (task.groupId) {
    const membership = await db.familyMember.findFirst({
      where: { groupId: task.groupId, userId },
      select: { id: true },
    })
    if (membership) return task
  }
  throw new ApiError(404, 'Задача не найдена')
}

// ==================== Обработчики ====================

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await params
    const existing = await getAccessibleTask(userId, id)
    const body = await readJsonBody(req)

    const data: Prisma.TaskUncheckedUpdateInput = {}

    if ('title' in body && body['title'] !== null && body['title'] !== '') {
      data.title = reqString(body, 'title', { min: 1, max: 200 })
    }
    if ('description' in body) {
      data.description = optString(body, 'description', 2000)
    }
    const priority = optEnumField(body, 'priority', TASK_PRIORITIES)
    if (priority) data.priority = priority
    const status = optEnumField(body, 'status', TASK_STATUSES)
    if (status) {
      data.status = status
      data.completedAt = status === 'done' ? new Date() : null
    }

    // Дедлайн (после него пересчитываем зависящее от срока напоминание)
    const deadlineProvided = 'deadline' in body
    const deadlineUpdate = deadlineProvided ? (optDeadline(body) ?? null) : undefined
    const effectiveDeadline = deadlineUpdate !== undefined ? deadlineUpdate : existing.deadline
    if (deadlineUpdate !== undefined) data.deadline = deadlineUpdate

    // Группа задачи
    let targetGroupId = existing.groupId
    if ('groupId' in body) {
      const v = body['groupId']
      if (v === null || v === '') {
        targetGroupId = null
        data.groupId = null
        // Исполнитель имеет смысл только внутри группы
        if (existing.assigneeId) data.assigneeId = null
      } else if (typeof v === 'string') {
        await assertGroupAccess(userId, v)
        targetGroupId = v
        data.groupId = v
      } else {
        throw new ApiError(400, 'Некорректное поле: groupId')
      }
    }

    // Исполнитель — только в групповых задачах и только из числа членов группы
    if ('assigneeId' in body) {
      const v = body['assigneeId']
      if (v === null || v === '') {
        data.assigneeId = null
      } else if (typeof v === 'string') {
        if (!targetGroupId) throw new ApiError(400, 'Назначить исполнителя можно только в семейной группе')
        const member = await db.familyMember.findFirst({
          where: { groupId: targetGroupId, userId: v },
          select: { id: true },
        })
        if (!member) throw new ApiError(400, 'Исполнитель не является членом группы')
        data.assigneeId = v
      } else {
        throw new ApiError(400, 'Некорректное поле: assigneeId')
      }
    }

    // Напоминание: нет поля — не трогаем; null — удаляем; объект — заменяем
    const reminderProvided = 'reminder' in body
    let reminderCreate: Prisma.ReminderUncheckedCreateWithoutTaskInput | undefined
    if (reminderProvided) {
      const v = body['reminder']
      if (v === null || v === '') {
        reminderCreate = undefined
      } else if (typeof v === 'object' && !Array.isArray(v)) {
        reminderCreate = validateReminderInput(v as Record<string, unknown>, effectiveDeadline)
      } else {
        throw new ApiError(400, 'Некорректное поле: reminder')
      }
    }

    const reminderDependsOnDeadline =
      existing.reminder?.type === 'at_deadline' || existing.reminder?.type === 'before'

    if (reminderCreate) {
      // Заменить напоминание
      await db.reminder.deleteMany({ where: { taskId: existing.id } })
      data.reminder = { create: reminderCreate }
    } else if (reminderProvided) {
      // Напоминание явно снято
      await db.reminder.deleteMany({ where: { taskId: existing.id } })
    } else if (!effectiveDeadline && reminderDependsOnDeadline) {
      // Срок сняли — напоминание "в срок"/"заранее" больше не имеет смысла
      await db.reminder.deleteMany({ where: { taskId: existing.id } })
    }

    const updated = await db.task.update({
      where: { id: existing.id },
      data,
      include: TASK_INCLUDE,
    })

    return NextResponse.json(taskToDTO(updated))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await params
    const task = await getAccessibleTask(userId, id)
    // Каскадно удалит и напоминание
    await db.task.delete({ where: { id: task.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
