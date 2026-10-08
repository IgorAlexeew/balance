import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { TRANSACTION_TYPES, type TransactionDTO } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  invalidateBudget,
  transactionApi,
} from '@/entities/transaction'
import { cn } from '@/shared/lib/cn'
import { kopecksToInput, parseRublesToKopecks, todayLocalDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { DatePicker } from '@/shared/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'

const formSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: z
    .string()
    .refine((v) => parseRublesToKopecks(v) !== null, 'Сумма больше нуля, не более двух знаков после запятой'),
  category: z.string().min(1, 'Выберите категорию'),
  description: z.string().max(500),
  date: z.string().min(1, 'Укажите дату'),
})
type FormValues = z.infer<typeof formSchema>

const TYPE_OPTIONS = [
  {
    value: 'expense',
    label: 'Расход',
    icon: TrendingDown,
    active: 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  {
    value: 'income',
    label: 'Доход',
    icon: TrendingUp,
    active: 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
] as const

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: TransactionDTO | null
}) {
  const { groupId } = useActiveGroup()
  const queryClient = useQueryClient()

  // Родитель пересоздаёт диалог через key при каждом открытии
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: transaction?.type ?? 'expense',
      amount: transaction ? kopecksToInput(transaction.amount) : '',
      category: transaction?.category ?? '',
      description: transaction?.description ?? '',
      date: transaction?.date ?? todayLocalDate(),
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const input = {
        type: v.type,
        amount: parseRublesToKopecks(v.amount)!,
        category: v.category,
        description: v.description.trim() || null,
        date: v.date,
      }
      return transaction
        ? transactionApi.update(transaction.id, input)
        : transactionApi.create({ ...input, groupId })
    },
    onSuccess: () => {
      toast.success(transaction ? 'Запись обновлена' : 'Запись добавлена')
      invalidateBudget(queryClient)
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Редактировать запись' : 'Новая запись'}</DialogTitle>
          <DialogDescription>
            {transaction ? 'Измените параметры операции' : 'Запишите доход или расход за день'}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
          <FieldGroup className="gap-4">
            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Тип операции">
                  {TYPE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={field.value === o.value}
                      onClick={() => {
                        if (field.value === o.value) return
                        field.onChange(o.value)
                        const list = o.value === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
                        if (!list.some((c) => c.name === form.getValues('category')))
                          form.setValue('category', '')
                      }}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                        field.value === o.value
                          ? o.active
                          : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <o.icon className="size-4" />
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            />

            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tx-amount">Сумма, ₽</FieldLabel>
                  <Input
                    {...field}
                    id="tx-amount"
                    inputMode="decimal"
                    placeholder="0"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    autoFocus
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="category"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Категория</FieldLabel>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {categories.map((c) => {
                      const selected = field.value === c.name
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => field.onChange(c.name)}
                          aria-pressed={selected}
                          title={c.name}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-xs font-medium transition-colors',
                            selected
                              ? cn('border-transparent', c.chipClass)
                              : 'bg-background hover:bg-accent',
                          )}
                        >
                          <span className="shrink-0 leading-none">{c.icon}</span>
                          <span className="truncate">{c.name}</span>
                        </button>
                      )
                    })}
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="tx-description">Описание</FieldLabel>
                  <Input
                    {...field}
                    id="tx-description"
                    placeholder="Например, продукты на неделю"
                    maxLength={500}
                  />
                </Field>
              )}
            />

            <Controller
              name="date"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tx-date">Дата</FieldLabel>
                  <DatePicker
                    id="tx-date"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              {transaction ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
