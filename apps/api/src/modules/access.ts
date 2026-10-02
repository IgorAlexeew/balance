import { prisma } from '../db'
import { forbidden } from '../lib/errors'

export async function getMemberGroupIds(userId: string): Promise<string[]> {
  const rows = await prisma.familyMember.findMany({ where: { userId }, select: { groupId: true } })
  return rows.map((r) => r.groupId)
}

export async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
  const row = await prisma.familyMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  })
  return row !== null
}

export async function assertGroupMember(userId: string, groupId: string): Promise<void> {
  if (!(await isGroupMember(userId, groupId))) throw forbidden('Нет доступа к этой семейной группе')
}

/**
 * Доступ к записи, которая принадлежит либо пользователю (личная), либо группе:
 * групповая — любому участнику группы, личная — только владельцу.
 */
export async function canAccessOwned(
  userId: string,
  record: { ownerId: string; groupId: string | null },
): Promise<boolean> {
  if (record.groupId) return isGroupMember(userId, record.groupId)
  return record.ownerId === userId
}
