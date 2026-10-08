import type {
  BudgetAnalysisDTO,
  BudgetSummaryDTO,
  TransactionCreateInput,
  TransactionDTO,
  TransactionUpdateInput,
} from '@balance/contracts'
import { http, withQuery } from '@/shared/api'

export const transactionApi = {
  list: (month: string, groupId: string | null) =>
    http.get<TransactionDTO[]>(withQuery('/transactions', { month, groupId })),
  create: (input: TransactionCreateInput) => http.post<TransactionDTO>('/transactions', input),
  update: (id: string, input: TransactionUpdateInput) =>
    http.patch<TransactionDTO>(`/transactions/${id}`, input),
  remove: (id: string) => http.delete(`/transactions/${id}`),
  summary: (month: string, groupId: string | null) =>
    http.get<BudgetSummaryDTO>(withQuery('/budget/summary', { month, groupId })),
  analysis: (month: string, groupId: string | null) =>
    http.post<BudgetAnalysisDTO>('/budget/analysis', { month, groupId }),
}
