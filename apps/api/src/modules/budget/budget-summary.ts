import type { BudgetSummaryDTO, TransactionType } from '@balance/contracts'

interface Row {
  type: string
  amount: number
  category: string
  date: string
}

/** Сводка месяца по операциям (все суммы — целые копейки, без ошибок округления) */
export function buildBudgetSummary(month: string, rows: Row[]): BudgetSummaryDTO {
  const [year, monthNum] = month.split('-').map(Number) as [number, number]
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const byDay = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, income: 0, expense: 0 }))
  const byCategory = new Map<
    string,
    { category: string; type: TransactionType; total: number; count: number }
  >()
  let totalIncome = 0
  let totalExpense = 0

  for (const row of rows) {
    const type: TransactionType = row.type === 'income' ? 'income' : 'expense'
    if (type === 'income') totalIncome += row.amount
    else totalExpense += row.amount

    const key = `${type}:${row.category}`
    const cat = byCategory.get(key) ?? { category: row.category, type, total: 0, count: 0 }
    cat.total += row.amount
    cat.count += 1
    byCategory.set(key, cat)

    const day = byDay[Number(row.date.slice(8, 10)) - 1]
    if (day) day[type] += row.amount
  }

  return {
    month,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
    byDay,
  }
}
