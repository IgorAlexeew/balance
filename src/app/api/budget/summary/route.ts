import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertGroupAccess,
  handleApiError,
  monthRange,
  parseMonthParam,
  requireUserId,
} from '@/lib/api-helpers'
import type { BudgetSummaryDTO, TransactionType } from '@/lib/types'

export const runtime = 'nodejs'

/** Округление до копеек (убирает шум арифметики Float) */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** GET /api/budget/summary?month=YYYY-MM&groupId=<id> — сводка бюджета месяца */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(req.url)
    const month = parseMonthParam(url.searchParams.get('month'))
    const { start, end } = monthRange(month)

    const rawGroupId = url.searchParams.get('groupId')
    const groupId = rawGroupId && rawGroupId.trim() ? rawGroupId.trim() : null
    if (groupId) {
      await assertGroupAccess(userId, groupId)
    }

    const transactions = await db.transaction.findMany({
      where: {
        // Тот же скоуп, что и в GET /api/transactions: личный или групповой
        ...(groupId ? { groupId } : { userId, groupId: null }),
        date: { gte: start, lt: end },
      },
    })

    let totalIncome = 0
    let totalExpense = 0
    const categoryMap = new Map<
      string,
      { category: string; type: TransactionType; total: number; count: number }
    >()

    const [year, monthNum] = month.split('-').map(Number)
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
    const byDay = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      income: 0,
      expense: 0,
    }))

    for (const tx of transactions) {
      const type: TransactionType = tx.type === 'income' ? 'income' : 'expense'
      const amount = tx.amount

      if (type === 'income') {
        totalIncome += amount
      } else {
        totalExpense += amount
      }

      const catKey = `${type}::${tx.category}`
      const cat = categoryMap.get(catKey)
      if (cat) {
        cat.total += amount
        cat.count += 1
      } else {
        categoryMap.set(catKey, { category: tx.category, type, total: amount, count: 1 })
      }

      const dayEntry = byDay[tx.date.getUTCDate() - 1]
      if (dayEntry) {
        if (type === 'income') dayEntry.income += amount
        else dayEntry.expense += amount
      }
    }

    const summary: BudgetSummaryDTO = {
      month,
      totalIncome: round2(totalIncome),
      totalExpense: round2(totalExpense),
      balance: round2(totalIncome - totalExpense),
      byCategory: Array.from(categoryMap.values())
        .map((c) => ({ ...c, total: round2(c.total) }))
        .sort((a, b) => b.total - a.total),
      byDay: byDay.map((d) => ({
        day: d.day,
        income: round2(d.income),
        expense: round2(d.expense),
      })),
    }

    return NextResponse.json(summary)
  } catch (e) {
    return handleApiError(e)
  }
}
