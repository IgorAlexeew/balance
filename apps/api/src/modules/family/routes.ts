import { randomInt } from 'node:crypto'
import { Hono } from 'hono'
import { Prisma } from '@prisma/client'
import {
  familyCreateSchema,
  familyJoinSchema,
  idSchema,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type FamilyGroupDTO,
  type MemberRole,
} from '@balance/contracts'
import { z } from 'zod'
import { prisma } from '../../db'
import { ApiError, forbidden, notFound } from '../../lib/errors'
import { rateLimit } from '../../lib/rate-limit'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'

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

function randomInviteCode(): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)]
  return code
}

/** Уникальность гарантирует индекс БД; при коллизии пробуем снова */
async function withUniqueInviteCode<T>(fn: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn(randomInviteCode())
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
    }
  }
  throw new ApiError(500, 'Не удалось сгенерировать код приглашения, попробуйте ещё раз')
}

const idParam = z.object({ id: idSchema })

async function getMembership(userId: string, groupId: string) {
  const membership = await prisma.familyMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  })
  if (!membership) throw notFound('Группа не найдена')
  return membership
}

export const familyRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => {
    const groups = await prisma.familyGroup.findMany({
      where: { members: { some: { userId: c.get('user').id } } },
      include: GROUP_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
    return c.json(groups.map(groupToDTO))
  })

  .post('/', validate('json', familyCreateSchema), async (c) => {
    const user = c.get('user')
    const input = c.req.valid('json')
    const group = await withUniqueInviteCode((inviteCode) =>
      prisma.familyGroup.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          inviteCode,
          ownerId: user.id,
          members: { create: { userId: user.id, role: 'owner' } },
        },
        include: GROUP_INCLUDE,
      }),
    )
    return c.json(groupToDTO(group), 201)
  })

  .post(
    '/join',
    rateLimit({ name: 'family-join', limit: 10, windowMs: 10 * 60 * 1000, message: 'Слишком много попыток, попробуйте позже' }),
    validate('json', familyJoinSchema),
    async (c) => {
      const user = c.get('user')
      const group = await prisma.familyGroup.findUnique({ where: { inviteCode: c.req.valid('json').inviteCode } })
      if (!group) throw notFound('Группа по этому коду не найдена')
      try {
        await prisma.familyMember.create({ data: { groupId: group.id, userId: user.id, role: 'member' } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ApiError(409, 'Вы уже состоите в этой группе')
        }
        throw e
      }
      const updated = await prisma.familyGroup.findUniqueOrThrow({ where: { id: group.id }, include: GROUP_INCLUDE })
      return c.json(groupToDTO(updated))
    },
  )

  /** Новый код приглашения (старый перестаёт работать) — только владелец */
  .post('/:id/invite-code', validate('param', idParam), async (c) => {
    const membership = await getMembership(c.get('user').id, c.req.valid('param').id)
    if (membership.group.ownerId !== membership.userId) throw forbidden('Обновить код может только владелец')
    const group = await withUniqueInviteCode((inviteCode) =>
      prisma.familyGroup.update({ where: { id: membership.groupId }, data: { inviteCode }, include: GROUP_INCLUDE }),
    )
    return c.json(groupToDTO(group))
  })

  /** Выйти из группы: владелец передаёт её старейшему участнику, последний — удаляет */
  .post('/:id/leave', validate('param', idParam), async (c) => {
    const user = c.get('user')
    const membership = await getMembership(user.id, c.req.valid('param').id)
    const groupId = membership.groupId

    await prisma.$transaction(async (tx) => {
      const heir = await tx.familyMember.findFirst({
        where: { groupId, userId: { not: user.id } },
        orderBy: { createdAt: 'asc' },
      })
      if (!heir) {
        await tx.familyGroup.delete({ where: { id: groupId } })
        return
      }
      // Задачи группы, назначенные уходящему, остаются без исполнителя
      await tx.task.updateMany({ where: { groupId, assigneeId: user.id }, data: { assigneeId: null } })
      if (membership.group.ownerId === user.id) {
        await tx.familyMember.update({ where: { id: heir.id }, data: { role: 'owner' } })
        await tx.familyGroup.update({ where: { id: groupId }, data: { ownerId: heir.userId } })
      }
      await tx.familyMember.delete({ where: { id: membership.id } })
    })
    return c.json({ ok: true })
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const membership = await getMembership(c.get('user').id, c.req.valid('param').id)
    if (membership.group.ownerId !== membership.userId) throw forbidden('Удалить группу может только владелец')
    await prisma.familyGroup.delete({ where: { id: membership.groupId } })
    return c.json({ ok: true })
  })
