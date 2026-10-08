import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { TaskFilter, taskCreateSchema, taskUpdateSchema } from '@balance/contracts'
import type { z } from 'zod'
import { badRequest, notFound } from '../../common/api-error'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessService } from '../access/access.service'
import { reminderData } from '../reminders/reminder-data'
import { RemindersService } from '../reminders/reminders.service'
import { compareTasks, TASK_INCLUDE, taskToDTO } from './task.mapper'

type CreateInput = z.output<typeof taskCreateSchema>
type UpdateInput = z.output<typeof taskUpdateSchema>

const needsDeadline = (type: string | undefined) => type === 'at_deadline' || type === 'before'

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly reminders: RemindersService,
  ) {}

  /** scope: personal — личные, all — все доступные, иначе id группы */
  async list(userId: string, status: TaskFilter, scope: string) {
    const where: Prisma.TaskWhereInput[] = []
    if (scope === 'personal') {
      where.push({ groupId: null, createdById: userId })
    } else if (scope === 'all') {
      const groupIds = await this.access.memberGroupIds(userId)
      where.push({ OR: [{ groupId: null, createdById: userId }, { groupId: { in: groupIds } }] })
    } else {
      await this.access.assertMember(userId, scope)
      where.push({ groupId: scope })
    }
    if (status === 'todo' || status === 'done') where.push({ status })
    if (status === 'overdue') where.push({ status: 'todo', deadline: { lt: new Date() } })

    const tasks = await this.prisma.task.findMany({ where: { AND: where }, include: TASK_INCLUDE })
    return tasks.sort(compareTasks).map(taskToDTO)
  }

  async create(userId: string, input: CreateInput) {
    const groupId = input.groupId ?? null
    const deadline = input.deadline ? new Date(input.deadline) : null

    if (groupId) await this.access.assertMember(userId, groupId)
    if (input.assigneeId) await this.assertAssignable(groupId, input.assigneeId)
    if (needsDeadline(input.reminder?.type) && !deadline) {
      throw badRequest('Для напоминания относительно срока укажите срок выполнения')
    }

    const created = await this.prisma.$transaction(async (tx) => {
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
          createdById: userId,
          ...(input.reminder ? { reminder: { create: reminderData(input.reminder) } } : {}),
        },
      })
      await this.reminders.rescheduleTask(task.id, tx)
      return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: TASK_INCLUDE })
    })
    return taskToDTO(created)
  }

  async update(userId: string, id: string, input: UpdateInput) {
    const existing = await this.getAccessible(userId, id)
    const data: Prisma.TaskUncheckedUpdateInput = {}

    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description
    if (input.priority !== undefined) data.priority = input.priority
    if (input.status !== undefined && input.status !== existing.status) {
      data.status = input.status
      data.completedAt = input.status === 'done' ? new Date() : null
    }
    let deadline = existing.deadline
    if (input.deadline !== undefined) {
      deadline = input.deadline ? new Date(input.deadline) : null
      data.deadline = deadline
    }

    // Исполнитель обязан быть участником итоговой группы
    const groupId = input.groupId !== undefined ? input.groupId : existing.groupId
    if (input.groupId !== undefined && input.groupId !== existing.groupId) {
      if (input.groupId) await this.access.assertMember(userId, input.groupId)
      data.groupId = input.groupId
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) await this.assertAssignable(groupId, input.assigneeId)
      data.assigneeId = input.assigneeId
    } else if (existing.assigneeId && groupId !== existing.groupId) {
      const stillMember = groupId ? await this.access.isMember(existing.assigneeId, groupId) : false
      if (!stillMember) data.assigneeId = null
    }

    let reminder = input.reminder
    const reminderType = reminder !== undefined ? reminder?.type : existing.reminder?.type
    if (needsDeadline(reminderType) && !deadline) {
      if (reminder !== undefined)
        throw badRequest('Для напоминания относительно срока укажите срок выполнения')
      // Срок сняли — напоминание «в срок»/«заранее» теряет смысл
      reminder = null
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (reminder !== undefined) {
        await tx.reminder.deleteMany({ where: { taskId: existing.id } })
        if (reminder) data.reminder = { create: reminderData(reminder) }
      }
      await tx.task.update({ where: { id: existing.id }, data })
      await this.reminders.rescheduleTask(existing.id, tx)
      return tx.task.findUniqueOrThrow({ where: { id: existing.id }, include: TASK_INCLUDE })
    })
    return taskToDTO(updated)
  }

  async remove(userId: string, id: string) {
    const task = await this.getAccessible(userId, id)
    await this.prisma.task.delete({ where: { id: task.id } })
  }

  /** Групповая задача видна участникам группы, личная — только автору; иначе 404 */
  private async getAccessible(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE })
    if (
      !task ||
      !(await this.access.canAccess(userId, { ownerId: task.createdById, groupId: task.groupId }))
    ) {
      throw notFound('Задача не найдена')
    }
    return task
  }

  private async assertAssignable(groupId: string | null, assigneeId: string) {
    if (!groupId) throw badRequest('Назначить исполнителя можно только в семейной группе')
    if (!(await this.access.isMember(assigneeId, groupId))) {
      throw badRequest('Исполнитель не является участником группы')
    }
  }
}
