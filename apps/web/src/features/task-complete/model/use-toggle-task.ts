import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { TaskDTO } from '@balance/contracts'
import { taskApi, taskKeys } from '@/entities/task'

export function useToggleTask(task: TaskDTO) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => taskApi.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    onError: (e: Error) => toast.error(e.message),
  })
}
