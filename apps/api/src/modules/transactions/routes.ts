import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import {
  budgetQuerySchema,
  idSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  type TransactionDTO,
  type TransactionType,
} from '@balance/contracts'
import { z } from 'zod'
import { prisma } from '../../db'
import { notFound } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'
import { assertGroupMember, canAccessOwned } from '../access'
import { monthDateRange, transactionScopeWhere } from './scope'

type TransactionWithUser = Prisma.TransactionGetPayload<{ include: { user: true } }>

export function transactionToDTO(t: TransactionWithUser): TransactionDTO {
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

const idParam = z.object({ id: idSchema })

async function getAccessibleTransaction(userId: string, id: string) {
  const tx = await prisma.transaction.findUnique({ where: { id } })
  if (!tx || !(await canAccessOwned(userId, { ownerId: tx.userId, groupId: tx.groupId }))) {
    throw notFound('Запись не найдена')
  }
  return tx
}

export const transactionRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', validate('query', budgetQuerySchema), async (c) => {
    const { month, groupId } = c.req.valid('query')
    const { from, to } = monthDateRange(month)
    const scope = await transactionScopeWhere(c.get('user').id, groupId)
    const rows = await prisma.transaction.findMany({
      where: { ...scope, date: { gte: from, lt: to } },
      include: { user: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    return c.json(rows.map(transactionToDTO))
  })

  .post('/', validate('json', transactionCreateSchema), async (c) => {
    const user = c.get('user')
    const { groupId, ...input } = c.req.valid('json')
    if (groupId) await assertGroupMember(user.id, groupId)
    const created = await prisma.transaction.create({
      data: { ...input, description: input.description ?? null, userId: user.id, groupId: groupId ?? null },
      include: { user: true },
    })
    return c.json(transactionToDTO(created), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', transactionUpdateSchema), async (c) => {
    const tx = await getAccessibleTransaction(c.get('user').id, c.req.valid('param').id)
    const updated = await prisma.transaction.update({
      where: { id: tx.id },
      data: c.req.valid('json'),
      include: { user: true },
    })
    return c.json(transactionToDTO(updated))
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const tx = await getAccessibleTransaction(c.get('user').id, c.req.valid('param').id)
    await prisma.transaction.delete({ where: { id: tx.id } })
    return c.json({ ok: true })
  })
