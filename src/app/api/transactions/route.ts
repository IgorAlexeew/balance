import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactionToDTO } from '@/lib/dto'
import {
  ApiError,
  assertGroupAccess,
  handleApiError,
  monthRange,
  numField,
  optString,
  parseMonthParam,
  reqString,
  requireUserId,
  transactionDate,
} from '@/lib/api-helpers'

export const runtime = 'nodejs'

/** Разбирает groupId: отсутствует/пустой => null (личный контекст) */
function parseGroupId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v || null
}

/** Валидирует дату транзакции "YYYY-MM-DD" => Date (полдень UTC) */
function parseTransactionDate(value: unknown): Date {
  const str = typeof value === 'string' ? value : ''
  const date = transactionDate(str)
  // Отсекаем «переходящие» даты вида 2026-02-31 (JS скатывает их в март)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== str) {
    throw new ApiError(400, 'Некорректная дата (ожидается YYYY-MM-DD)')
  }
  return date
}

/** GET /api/transactions?month=YYYY-MM&groupId=<id> — транзакции месяца (личные или группы) */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId()
    const url = new URL(req.url)
    const month = parseMonthParam(url.searchParams.get('month'))
    const { start, end } = monthRange(month)
    const groupId = parseGroupId(url.searchParams.get('groupId'))

    if (groupId) {
      await assertGroupAccess(userId, groupId)
    }

    const transactions = await db.transaction.findMany({
      where: {
        // Личный контекст: свои записи без группы; групповой: записи группы всех членов
        ...(groupId ? { groupId } : { userId, groupId: null }),
        date: { gte: start, lt: end },
      },
      include: { user: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(transactions.map(transactionToDTO))
  } catch (e) {
    return handleApiError(e)
  }
}

/** POST /api/transactions — создать транзакцию (личную или групповую) */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    if (body.type !== 'income' && body.type !== 'expense') {
      throw new ApiError(400, 'Укажите тип операции')
    }
    const type = body.type
    const amount = numField(body, 'amount', 0.01, 1_000_000_000)
    const category = reqString(body, 'category', { min: 1, max: 60 })
    const date = parseTransactionDate(body.date)
    const description = optString(body, 'description', 500)

    let groupId: string | null = null
    const rawGroupId = body.groupId
    if (typeof rawGroupId === 'string' && rawGroupId.trim()) {
      groupId = rawGroupId.trim()
      await assertGroupAccess(userId, groupId)
    } else if (rawGroupId !== null && rawGroupId !== undefined && rawGroupId !== '') {
      throw new ApiError(400, 'Некорректное поле: groupId')
    }

    const created = await db.transaction.create({
      data: { type, amount, category, description, date, userId, groupId },
      include: { user: true },
    })

    return NextResponse.json(transactionToDTO(created), { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}
