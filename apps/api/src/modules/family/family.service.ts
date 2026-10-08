import { randomInt } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type FamilyGroupDTO,
  type MemberRole,
  type familyCreateSchema,
} from '@balance/contracts'
import type { z } from 'zod'
import { ApiError, forbidden, notFound } from '../../common/api-error'
import { PrismaService } from '../../prisma/prisma.service'

const GROUP_INCLUDE = { members: { include: { user: true }, orderBy: { createdAt: 'asc' } } } as const
type GroupWithMembers = Prisma.FamilyGroupGetPayload<{ include: typeof GROUP_INCLUDE }>

function groupToDTO(g: GroupWithMembers): FamilyGroupDTO {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    inviteCode: g.inviteCode,
    ownerId: g.ownerId,
    createdAt: g.createdAt.toISOString(),
    // email участников не отдаём: другим членам группы он не нужен
    members: g.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      image: m.user.image,
      role: m.role as MemberRole,
      joinedAt: m.createdAt.toISOString(),
    })),
  }
}

export function randomInviteCode(): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++)
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)]
  return code
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const groups = await this.prisma.familyGroup.findMany({
      where: { members: { some: { userId } } },
      include: GROUP_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
    return groups.map(groupToDTO)
  }

  async create(userId: string, input: z.output<typeof familyCreateSchema>) {
    const group = await this.withUniqueInviteCode((inviteCode) =>
      this.prisma.familyGroup.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          inviteCode,
          ownerId: userId,
          members: { create: { userId, role: 'owner' } },
        },
        include: GROUP_INCLUDE,
      }),
    )
    return groupToDTO(group)
  }

  async join(userId: string, inviteCode: string) {
    const group = await this.prisma.familyGroup.findUnique({ where: { inviteCode } })
    if (!group) throw notFound('Группа по этому коду не найдена')
    try {
      await this.prisma.familyMember.create({ data: { groupId: group.id, userId, role: 'member' } })
    } catch (e) {
      if (isUniqueViolation(e)) throw new ApiError(409, 'Вы уже состоите в этой группе')
      throw e
    }
    const updated = await this.prisma.familyGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: GROUP_INCLUDE,
    })
    return groupToDTO(updated)
  }

  /** Новый код приглашения (старый перестаёт работать) — только владелец */
  async regenerateInviteCode(userId: string, groupId: string) {
    const membership = await this.getMembership(userId, groupId)
    if (membership.group.ownerId !== userId) throw forbidden('Обновить код может только владелец')
    const group = await this.withUniqueInviteCode((inviteCode) =>
      this.prisma.familyGroup.update({
        where: { id: groupId },
        data: { inviteCode },
        include: GROUP_INCLUDE,
      }),
    )
    return groupToDTO(group)
  }

  /** Выход: владелец передаёт группу самому давнему участнику, последний — удаляет её */
  async leave(userId: string, groupId: string) {
    const membership = await this.getMembership(userId, groupId)
    await this.prisma.$transaction(async (tx) => {
      const heir = await tx.familyMember.findFirst({
        where: { groupId, userId: { not: userId } },
        orderBy: { createdAt: 'asc' },
      })
      if (!heir) {
        await tx.familyGroup.delete({ where: { id: groupId } })
        return
      }
      // Задачи группы, назначенные уходящему, остаются без исполнителя
      await tx.task.updateMany({ where: { groupId, assigneeId: userId }, data: { assigneeId: null } })
      if (membership.group.ownerId === userId) {
        await tx.familyMember.update({ where: { id: heir.id }, data: { role: 'owner' } })
        await tx.familyGroup.update({ where: { id: groupId }, data: { ownerId: heir.userId } })
      }
      await tx.familyMember.delete({ where: { id: membership.id } })
    })
  }

  async remove(userId: string, groupId: string) {
    const membership = await this.getMembership(userId, groupId)
    if (membership.group.ownerId !== userId) throw forbidden('Удалить группу может только владелец')
    await this.prisma.familyGroup.delete({ where: { id: groupId } })
  }

  private async getMembership(userId: string, groupId: string) {
    const membership = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    })
    if (!membership) throw notFound('Группа не найдена')
    return membership
  }

  /** Уникальность гарантирует индекс БД; при коллизии пробуем снова */
  private async withUniqueInviteCode<T>(fn: (code: string) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await fn(randomInviteCode())
      } catch (e) {
        if (!isUniqueViolation(e)) throw e
      }
    }
    throw new ApiError(500, 'Не удалось сгенерировать код приглашения, попробуйте ещё раз')
  }
}
