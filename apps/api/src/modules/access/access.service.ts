import { Injectable } from '@nestjs/common'
import { forbidden } from '../../common/api-error'
import { PrismaService } from '../../prisma/prisma.service'

/** Проверки членства в семейных группах */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async memberGroupIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.familyMember.findMany({ where: { userId }, select: { groupId: true } })
    return rows.map((r) => r.groupId)
  }

  async isMember(userId: string, groupId: string): Promise<boolean> {
    const row = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    })
    return row !== null
  }

  async assertMember(userId: string, groupId: string): Promise<void> {
    if (!(await this.isMember(userId, groupId))) throw forbidden('Нет доступа к этой семейной группе')
  }

  /** Групповая запись доступна участникам группы, личная — только владельцу */
  async canAccess(userId: string, record: { ownerId: string; groupId: string | null }): Promise<boolean> {
    if (record.groupId) return this.isMember(userId, record.groupId)
    return record.ownerId === userId
  }
}
