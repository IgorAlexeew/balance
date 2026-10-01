'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/categories'
import { useAppStore } from '@/lib/store'
import type { TransactionDTO, TransactionType } from '@/lib/types'

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  transaction: TransactionDTO | null
}) {
  const groupId = useAppStore((s) => s.groupId)
  const queryClient = useQueryClient()

  // Родитель рендерит диалог с key={transaction?.id ?? 'new'},
  // поэтому инициализация через колбэк useState сбрасывается при смене записи.
  const [type, setType] = useState<TransactionType>(() => transaction?.type ?? 'expense')
  const [amount, setAmount] = useState(() => (transaction ? String(transaction.amount) : ''))
  const [category, setCategory] = useState(() => transaction?.category ?? '')
  const [description, setDescription] = useState(() => transaction?.description ?? '')
  const [date, setDate] = useState(() => transaction?.date ?? format(new Date(), 'yyyy-MM-dd'))

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const switchType = (next: TransactionType) => {
    if (type === next) return
    setType(next)
    const list = next === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    if (!list.some((c) => c.name === category)) setCategory('')
  }

  const save = useMutation({
    mutationFn: (amountNum: number) => {
      const input = {
        type,
        amount: amountNum,
        category,
        description: description.trim() || null,
        date,
        groupId: groupId ?? null,
      }
      return transaction
        ? api.transactions.update(transaction.id, input)
        : api.transactions.create(input)
    },
    onSuccess: () => {
      toast.success(transaction ? 'Запись обновлена' : 'Запись добавлена')
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['summary'] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = () => {
    const amountNum = Number(amount.trim().replace(',', '.'))
    if (!Number.isFinite(amountNum) || amountNum <= 0 || !category || !date) {
      toast.error('Заполните сумму, категорию и дату')
      return
    }
    save.mutate(amountNum)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Редактировать запись' : 'Новая запись'}</DialogTitle>
          <DialogDescription>
            {transaction ? 'Измените параметры операции' : 'Запишите доход или расход за день'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {/* Тип операции */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Тип операции">
            <button
              type="button"
              onClick={() => switchType('expense')}
              aria-pressed={type === 'expense'}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                type === 'expense'
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <TrendingDown className="size-4" />
              Расход
            </button>
            <button
              type="button"
              onClick={() => switchType('income')}
              aria-pressed={type === 'income'}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                type === 'income'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <TrendingUp className="size-4" />
              Доход
            </button>
          </div>

          {/* Сумма */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">
              Сумма <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tx-amount"
              type="number"
              min={0.01}
              step={0.01}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Категория */}
          <div className="space-y-1.5">
            <Label>
              Категория <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {categories.map((c) => {
                const selected = category === c.name
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    aria-pressed={selected}
                    title={c.name}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-xs font-medium transition-colors',
                      selected ? cn('border-transparent', c.chipClass) : 'bg-background hover:bg-accent'
                    )}
                  >
                    <span className="shrink-0 leading-none">{c.icon}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Описание */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Описание</Label>
            <Input
              id="tx-description"
              placeholder="Например, продукты в Пятёрочке"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Дата */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">
              Дата <span className="text-destructive">*</span>
            </Label>
            <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={save.isPending} className="gap-1.5">
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {transaction ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
