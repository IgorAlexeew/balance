import { useQuery } from '@tanstack/react-query'
import { eventApi } from '../api/event-api'

export const eventKeys = {
  all: ['events'] as const,
  range: (from: string, to: string, scope: string) => ['events', from, to, scope] as const,
}

export function useEvents(from: Date, to: Date, groupId: string | null) {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()
  return useQuery({
    queryKey: eventKeys.range(fromIso, toIso, groupId ?? 'personal'),
    queryFn: () => eventApi.list(fromIso, toIso, groupId),
  })
}
