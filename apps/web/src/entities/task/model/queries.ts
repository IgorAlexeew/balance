import { useQuery } from '@tanstack/react-query'
import type { TaskFilter } from '@balance/contracts'
import { taskApi } from '../api/task-api'

export const taskKeys = {
  all: ['tasks'] as const,
  list: (status: TaskFilter, scope: string) => ['tasks', 'list', status, scope] as const,
}

/** scope: id группы или 'personal' */
export function useTasks(status: TaskFilter, groupId: string | null) {
  const scope = groupId ?? 'personal'
  return useQuery({ queryKey: taskKeys.list(status, scope), queryFn: () => taskApi.list({ status, scope }) })
}
