import { useQuery, type QueryClient } from '@tanstack/react-query'
import { transactionApi } from '../api/transaction-api'

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (month: string, scope: string) => ['transactions', 'list', month, scope] as const,
  summaryAll: ['budget-summary'] as const,
  summary: (month: string, scope: string) => ['budget-summary', month, scope] as const,
}

export function useTransactions(month: string, groupId: string | null) {
  return useQuery({
    queryKey: transactionKeys.list(month, groupId ?? 'personal'),
    queryFn: () => transactionApi.list(month, groupId),
  })
}

export function useBudgetSummary(month: string, groupId: string | null) {
  return useQuery({
    queryKey: transactionKeys.summary(month, groupId ?? 'personal'),
    queryFn: () => transactionApi.summary(month, groupId),
  })
}

/** После изменения операций устаревают и списки, и сводки */
export function invalidateBudget(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all })
  void queryClient.invalidateQueries({ queryKey: transactionKeys.summaryAll })
}
