import { z } from 'zod'
import { groupRefSchema, localDateSchema, monthSchema, optionalText, requiredText } from './common'
import type { Kopecks } from './common'
import { TRANSACTION_TYPES, type TransactionType } from './enums'

/** 1 млрд рублей в копейках */
export const MAX_AMOUNT_KOPECKS = 100_000_000_000

const amountSchema = z
  .number({ error: 'Укажите сумму' })
  .int('Сумма передаётся в копейках (целое число)')
  .positive('Сумма должна быть больше нуля')
  .max(MAX_AMOUNT_KOPECKS, 'Слишком большая сумма')

const transactionFields = {
  type: z.enum(TRANSACTION_TYPES, { error: 'Укажите тип операции' }),
  amount: amountSchema,
  category: requiredText(60, 'Категория'),
  description: optionalText(500),
  date: localDateSchema,
}

export const transactionCreateSchema = z.object({ ...transactionFields, groupId: groupRefSchema })
export type TransactionCreateInput = z.input<typeof transactionCreateSchema>

export const transactionUpdateSchema = z.object({
  type: transactionFields.type.optional(),
  amount: transactionFields.amount.optional(),
  category: transactionFields.category.optional(),
  description: transactionFields.description,
  date: transactionFields.date.optional(),
})
export type TransactionUpdateInput = z.input<typeof transactionUpdateSchema>

export const budgetQuerySchema = z.object({
  month: monthSchema,
  groupId: groupRefSchema,
})
export type BudgetQuery = z.input<typeof budgetQuerySchema>

export interface TransactionDTO {
  id: string
  type: TransactionType
  /** В копейках */
  amount: Kopecks
  category: string
  description: string | null
  /** YYYY-MM-DD */
  date: string
  userId: string
  userName: string | null
  groupId: string | null
  createdAt: string
}

export interface BudgetSummaryDTO {
  month: string
  totalIncome: Kopecks
  totalExpense: Kopecks
  balance: Kopecks
  byCategory: { category: string; type: TransactionType; total: Kopecks; count: number }[]
  byDay: { day: number; income: Kopecks; expense: Kopecks }[]
}

export interface BudgetAnalysisDTO {
  analysis: string
}
