import { NextResponse } from 'next/server'
import type { Transaction } from '@prisma/client'
import { db } from '@/lib/db'
import { transactionToDTO } from '@/lib/dto'
import {
  ApiError,
  handleApiError,
  numField,
  optString,
  reqString,
  requireUserId,
  transactionDate,
} from '@/lib/api-helpers'

export const runtime = 'nodejs'

/**
 * Загружает транзакцию и проверяет доступ:
 * владелец записи ИЛИ член группы, если запись групповая; иначе 404.
 */
async function requireTransactionAccess(userId: string, id: string): Promise<Transaction> {
  const tx = await db.transaction.findUnique({ where: { id } })
  if (tx) {
    if (tx.userId === userId) return tx
    if (tx.groupId) {
      const membership = await db.familyMember.findFirst({
        where: { groupId: tx.groupId, userId },
      })
      if (membership) return tx
    }
  }
  throw new ApiError(404, 'Запись не найдена')
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

/** PATCH /api/transactions/[id] — частичное обновление транзакции */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await params
    await requireTransactionAccess(userId, id)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: {
      type?: string
      amount?: number
      category?: string
      description?: string | null
      date?: Date
    } = {}

    if (body.type !== undefined) {
      if (body.type !== 'income' && body.type !== 'expense') {
        throw new ApiError(400, 'Укажите тип операции')
      }
      data.type = body.type
    }
    if (body.amount !== undefined) {
      data.amount = numField(body, 'amount', 0.01, 1_000_000_000)
    }
    if (body.category !== undefined) {
      data.category = reqString(body, 'category', { min: 1, max: 60 })
    }
    if (body.description !== undefined) {
      data.description = optString(body, 'description', 500)
    }
    if (body.date !== undefined) {
      data.date = parseTransactionDate(body.date)
    }

    // Пустой patch — просто возвращаем текущую запись
    const updated = Object.keys(data).length
      ? await db.transaction.update({ where: { id }, data, include: { user: true } })
      : await db.transaction.findUniqueOrThrow({ where: { id }, include: { user: true } })

    return NextResponse.json(transactionToDTO(updated))
  } catch (e) {
    return handleApiError(e)
  }
}

/** DELETE /api/transactions/[id] — удалить транзакцию */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await params
    await requireTransactionAccess(userId, id)
    await db.transaction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
