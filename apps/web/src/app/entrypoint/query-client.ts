import { QueryCache, QueryClient } from '@tanstack/react-query'
import { sessionKeys } from '@/entities/session'
import { isApiError } from '@/shared/api'

export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // Сессия истекла: сбрасываем пользователя — роутер отправит на страницу входа
        if (isApiError(error, 401)) queryClient.setQueryData(sessionKeys.viewer, null)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        retry: (count, error) =>
          count < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
      },
    },
  })
  return queryClient
}
