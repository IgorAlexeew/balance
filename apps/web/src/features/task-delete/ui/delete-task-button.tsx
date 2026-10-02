import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { TaskDTO } from '@balance/contracts'
import { taskApi, taskKeys } from '@/entities/task'
import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/spinner'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

export function DeleteTaskButton({ task }: { task: TaskDTO }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => taskApi.remove(task.id),
    onSuccess: () => {
      toast.success('Задача удалена')
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <ConfirmDialog
      title="Удалить задачу?"
      description={`Задача «${task.title}» будет удалена безвозвратно.`}
      onConfirm={() => remove.mutate()}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Удалить задачу «${task.title}»`}
          disabled={remove.isPending}
        >
          {remove.isPending ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
        </Button>
      }
    />
  )
}
