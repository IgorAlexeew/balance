import type { TaskCreateInput, TaskDTO, TaskListQuery, TaskUpdateInput } from '@balance/contracts'
import { http, withQuery } from '@/shared/api'

export const taskApi = {
  list: (query: TaskListQuery) => http.get<TaskDTO[]>(withQuery('/tasks', { ...query })),
  create: (input: TaskCreateInput) => http.post<TaskDTO>('/tasks', input),
  update: (id: string, input: TaskUpdateInput) => http.patch<TaskDTO>(`/tasks/${id}`, input),
  remove: (id: string) => http.delete(`/tasks/${id}`),
}
