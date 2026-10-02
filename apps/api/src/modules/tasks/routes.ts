import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { idSchema, taskCreateSchema, taskListQuerySchema, taskUpdateSchema } from '@balance/contracts'
import { z } from 'zod'
import { prisma } from '../../db'
import { badRequest, notFound } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'
import { assertGroupMember, canAccessOwned, getMemberGroupIds, isGroupMember } from '../access'
import { reminderData, rescheduleTaskReminder } from '../reminders/service'
import { compareTasks, TASK_INCLUDE, taskToDTO } from './mapper'

const idParam = z.object({ id: idSchema })

/** Групповая задача видна участникам группы, личная — только автору */
async function getAccessibleTask(userId: string, id: string) {
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE })
  if (!task || !(await canAccessOwned(userId, { ownerId: task.createdById, groupId: task.groupId }))) {
    // 404, а не 403: не раскрываем существование чужих задач
    throw notFound('Задача не найдена')
  }
  return task
}

async function assertAssignable(groupId: string | null, assigneeId: string) {
  if (!groupId) throw badRequest('Назначить исполнителя можно только в семейной группе')
  if (!(await isGroupMember(assigneeId, groupId))) throw badRequest('Исполнитель не является участником группы')
}

function needsDeadline(type: string | undefined) {
  return type === 'at_deadline' || type === 'before'
}

export const taskRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', validate('query', taskListQuerySchema), async (c) => {
    const user = c.get('user')
    const { status, scope } = c.req.valid('query')

    const where: Prisma.TaskWhereInput[] = []
    if (scope === 'personal') {
      where.push({ groupId: null, createdById: user.id })
    } else if (scope === 'all') {
      const groupIds = await getMemberGroupIds(user.id)
      where.push({ OR: [{ groupId: null, createdById: user.id }, { groupId: { in: groupIds } }] })
    } else {
      await assertGroupMember(user.id, scope)
      where.push({ groupId: scope })
    }
    if (status === 'todo' || status === 'done') where.push({ status })
    if (status === 'overdue') where.push({ status: 'todo', deadline: { lt: new Date() } })

    const tasks = await prisma.task.findMany({ where: { AND: where }, include: TASK_INCLUDE })
    return c.json(tasks.sort(compareTasks).map(taskToDTO))
  })

  .post('/', validate('json', taskCreateSchema), async (c) => {
    const user = c.get('user')
    const input = c.req.valid('json')
    const groupId = input.groupId ?? null
    const deadline = input.deadline ? new Date(input.deadline) : null

    if (groupId) await assertGroupMember(user.id, groupId)
    if (input.assigneeId) await assertAssignable(groupId, input.assigneeId)
    if (needsDeadline(input.reminder?.type) && !deadline) {
      throw badRequest('Для напоминания относительно срока укажите срок выполнения')
    }

    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          deadline,
          completedAt: input.status === 'done' ? new Date() : null,
          assigneeId: input.assigneeId ?? null,
          groupId,
          createdById: user.id,
          ...(input.reminder ? { reminder: { create: reminderData(input.reminder) } } : {}),
        },
      })
      await rescheduleTaskReminder(task.id, tx)
      return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: TASK_INCLUDE })
    })
    return c.json(taskToDTO(created), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', taskUpdateSchema), async (c) => {
    const user = c.get('user')
    const existing = await getAccessibleTask(user.id, c.req.valid('param').id)
    const input = c.req.valid('json')
    const data: Prisma.TaskUncheckedUpdateInput = {}

    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description
    if (input.priority !== undefined) data.priority = input.priority
    if (input.status !== undefined && input.status !== existing.status) {
      data.status = input.status
      data.completedAt = input.status === 'done' ? new Date() : null
    }
    if (input.deadline !== undefined) data.deadline = input.deadline ? new Date(input.deadline) : null
    const deadline = data.deadline !== undefined ? (data.deadline as Date | null) : existing.deadline

    // Группа и исполнитель: исполнитель обязан быть участником итоговой группы
    const groupId = input.groupId !== undefined ? input.groupId : existing.groupId
    if (input.groupId !== undefined && input.groupId !== existing.groupId) {
      if (input.groupId) await assertGroupMember(user.id, input.groupId)
      data.groupId = input.groupId
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) await assertAssignable(groupId, input.assigneeId)
      data.assigneeId = input.assigneeId
    } else if (existing.assigneeId && groupId !== existing.groupId) {
      const stillMember = groupId ? await isGroupMember(existing.assigneeId, groupId) : false
      if (!stillMember) data.assigneeId = null
    }

    const reminderType = input.reminder !== undefined ? input.reminder?.type : existing.reminder?.type
    if (needsDeadline(reminderType) && !deadline) {
      if (input.reminder !== undefined) {
        throw badRequest('Для напоминания относительно срока укажите срок выполнения')
      }
      // Срок сняли — напоминание «в срок»/«заранее» теряет смысл
      input.reminder = null
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.reminder !== undefined) {
        await tx.reminder.deleteMany({ where: { taskId: existing.id } })
        if (input.reminder) data.reminder = { create: reminderData(input.reminder) }
      }
      await tx.task.update({ where: { id: existing.id }, data })
      await rescheduleTaskReminder(existing.id, tx)
      return tx.task.findUniqueOrThrow({ where: { id: existing.id }, include: TASK_INCLUDE })
    })
    return c.json(taskToDTO(updated))
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const task = await getAccessibleTask(c.get('user').id, c.req.valid('param').id)
    await prisma.task.delete({ where: { id: task.id } })
    return c.json({ ok: true })
  })
