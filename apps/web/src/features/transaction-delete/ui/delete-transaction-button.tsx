import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { TransactionDTO } from '@balance/contracts'
import { invalidateBudget, transactionApi } from '@/entities/transaction'
import { fmtDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'

export function DeleteTransactionButton({ transaction }: { transaction: TransactionDTO }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => transactionApi.remove(transaction.id),
    onSuccess: () => {
      toast.success('Запись удалена')
      invalidateBudget(queryClient)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <ConfirmDialog
      title="Удалить запись?"
      description={`Запись «${transaction.category}» за ${fmtDate(transaction.date)} будет удалена безвозвратно.`}
      onConfirm={() => remove.mutate()}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
          aria-label="Удалить запись"
          disabled={remove.isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
    />
  )
}
