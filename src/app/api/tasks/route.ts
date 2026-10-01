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

async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await db.familyMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  return memberships.map((m) => m.groupId)
}

/** Задачи, доступные пользователю: личные (созданные им или назначенные ему) + задачи его групп */
function accessibleTasksWhere(userId: string, groupIds: string[]): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [
    { groupId: null, OR: [{ createdById: userId }, { assigneeId: userId }] },
  ]
  if (groupIds.length > 0) conditions.push({ groupId: { in: groupIds } })
  return { OR: conditions }
}

/**
 * Сортировка в JS: сначала незавершённые (todo перед done),
 * затем по deadline ASC (null — в конце), затем createdAt DESC.
 */
function sortTasks(tasks: TaskWithRelations[]): TaskWithRelations[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0
    const bDone = b.status === 'done' ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    if (a.deadline && b.deadline) {
      const diff = a.deadline.getTime() - b.deadline.getTime()
      if (diff !== 0) return diff
    }
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
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

// ==================== Обработчики ====================

export async function GET(req: Request) {
  try {
    const userId = await requireUserId()
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') || 'all'
    const scope = searchParams.get('scope') || 'personal'

    const groupIds = await getUserGroupIds(userId)
    const conditions: Prisma.TaskWhereInput[] = [accessibleTasksWhere(userId, groupIds)]

    if (scope === 'personal') {
      conditions.push({ groupId: null })
    } else if (scope !== 'all') {
      // scope = id конкретной группы
      await assertGroupAccess(userId, scope)
      conditions.push({ groupId: scope })
    }

    if (statusFilter === 'todo') {
      conditions.push({ status: 'todo' })
    } else if (statusFilter === 'done') {
      conditions.push({ status: 'done' })
    } else if (statusFilter === 'overdue') {
      conditions.push({ status: 'todo', deadline: { lt: new Date() } })
    }

    const tasks = await db.task.findMany({
      where: { AND: conditions },
      include: TASK_INCLUDE,
    })

    return NextResponse.json(sortTasks(tasks).map(taskToDTO))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = await readJsonBody(req)

    const title = reqString(body, 'title', { min: 1, max: 200 })
    const description = optString(body, 'description', 2000)
    const status = optEnumField(body, 'status', TASK_STATUSES) ?? 'todo'
    const priority = optEnumField(body, 'priority', TASK_PRIORITIES) ?? 'medium'
    const deadline = optDeadline(body) ?? null

    // Семейная группа
    let groupId: string | null = null
    const rawGroupId = body['groupId']
    if (rawGroupId !== undefined && rawGroupId !== null && rawGroupId !== '') {
      if (typeof rawGroupId !== 'string') throw new ApiError(400, 'Некорректное поле: groupId')
      groupId = rawGroupId
      await assertGroupAccess(userId, groupId)
    }

    // Исполнитель — только в задачах группы и только из числа её членов
    let assigneeId: string | null = null
    const rawAssigneeId = body['assigneeId']
    if (rawAssigneeId !== undefined && rawAssigneeId !== null && rawAssigneeId !== '') {
      if (typeof rawAssigneeId !== 'string') throw new ApiError(400, 'Некорректное поле: assigneeId')
      if (!groupId) throw new ApiError(400, 'Назначить исполнителя можно только в семейной группе')
      const member = await db.familyMember.findFirst({
        where: { groupId, userId: rawAssigneeId },
        select: { id: true },
      })
      if (!member) throw new ApiError(400, 'Исполнитель не является членом группы')
      assigneeId = rawAssigneeId
    }

    // Напоминание
    let reminderCreate: Prisma.ReminderUncheckedCreateWithoutTaskInput | undefined
    const rawReminder = body['reminder']
    if (rawReminder !== undefined && rawReminder !== null) {
      if (typeof rawReminder !== 'object' || Array.isArray(rawReminder)) {
        throw new ApiError(400, 'Некорректное поле: reminder')
      }
      reminderCreate = validateReminderInput(rawReminder as Record<string, unknown>, deadline)
    }

    const task = await db.task.create({
      data: {
        title,
        description,
        status,
        priority,
        deadline,
        completedAt: status === 'done' ? new Date() : null,
        assigneeId,
        groupId,
        createdById: userId,
        ...(reminderCreate ? { reminder: { create: reminderCreate } } : {}),
      },
      include: TASK_INCLUDE,
    })

    return NextResponse.json(taskToDTO(task))
  } catch (e) {
    return handleApiError(e)
  }
}
