import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type {
  TransactionDTO,
  TransactionType,
  transactionCreateSchema,
  transactionUpdateSchema,
} from '@balance/contracts'
import type { z } from 'zod'
import { notFound } from '../../common/api-error'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessService } from '../access/access.service'
import { monthDateRange } from './scope'

type TransactionWithUser = Prisma.TransactionGetPayload<{ include: { user: true } }>

function transactionToDTO(t: TransactionWithUser): TransactionDTO {
  return {
    id: t.id,
    type: t.type as TransactionType,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date,
    userId: t.userId,
    userName: t.user.name,
    groupId: t.groupId,
    createdAt: t.createdAt.toISOString(),
  }
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Операции месяца: личные пользователя или группы (после проверки членства) */
  async monthWhere(userId: string, month: string, groupId: string | null | undefined) {
    const { from, to } = monthDateRange(month)
    if (groupId) {
      await this.access.assertMember(userId, groupId)
      return { groupId, date: { gte: from, lt: to } } satisfies Prisma.TransactionWhereInput
    }
    return { userId, groupId: null, date: { gte: from, lt: to } } satisfies Prisma.TransactionWhereInput
  }

  async list(userId: string, month: string, groupId: string | null | undefined) {
    const rows = await this.prisma.transaction.findMany({
      where: await this.monthWhere(userId, month, groupId),
      include: { user: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map(transactionToDTO)
  }

  async create(userId: string, { groupId, ...input }: z.output<typeof transactionCreateSchema>) {
    if (groupId) await this.access.assertMember(userId, groupId)
    const created = await this.prisma.transaction.create({
      data: { ...input, description: input.description ?? null, userId, groupId: groupId ?? null },
      include: { user: true },
    })
    return transactionToDTO(created)
  }

  async update(userId: string, id: string, input: z.output<typeof transactionUpdateSchema>) {
    const tx = await this.getAccessible(userId, id)
    const updated = await this.prisma.transaction.update({
      where: { id: tx.id },
      data: input,
      include: { user: true },
    })
    return transactionToDTO(updated)
  }

  async remove(userId: string, id: string) {
    const tx = await this.getAccessible(userId, id)
    await this.prisma.transaction.delete({ where: { id: tx.id } })
  }

  private async getAccessible(userId: string, id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } })
    if (!tx || !(await this.access.canAccess(userId, { ownerId: tx.userId, groupId: tx.groupId }))) {
      throw notFound('Запись не найдена')
    }
    return tx
  }
}
