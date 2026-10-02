import type { Prisma } from '@prisma/client'
import { assertGroupMember } from '../access'

/** Границы месяца YYYY-MM как диапазон дат YYYY-MM-DD [from, to) */
export function monthDateRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return { from: `${month}-01`, to: `${next}-01` }
}

/** Личные операции пользователя или операции группы (после проверки членства) */
export async function transactionScopeWhere(
  userId: string,
  groupId: string | null | undefined,
): Promise<Prisma.TransactionWhereInput> {
  if (groupId) {
    await assertGroupMember(userId, groupId)
    return { groupId }
  }
  return { userId, groupId: null }
}
