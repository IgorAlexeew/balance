import { Pencil, Plus, Wallet } from 'lucide-react'
import type { TransactionDTO } from '@balance/contracts'
import { CategoryChip } from '@/entities/transaction'
import { DeleteTransactionButton } from '@/features/transaction-delete'
import { cn } from '@/shared/lib/cn'
import { fmtDate, formatMoney, initials } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

export function TransactionsTable({
  transactions,
  isLoading,
  showAuthor,
  onCreate,
  onEdit,
}: {
  transactions: TransactionDTO[]
  isLoading: boolean
  showAuthor: boolean
  onCreate: () => void
  onEdit: (t: TransactionDTO) => void
}) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4.5 text-primary" />
            Операции за месяц
          </CardTitle>
          <Badge variant="secondary">{transactions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="space-y-2 p-4 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="mx-auto mb-2 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">В этом месяце записей пока нет</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={onCreate}>
              <Plus className="size-3.5" />
              Добавить запись
            </Button>
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-b-xl [&>div]:overflow-visible">
            <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
              <TableHeader className="sticky top-0 z-10 bg-background [&_th]:bg-background">
                <TableRow>
                  <TableHead className="w-20">Дата</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="hidden sm:table-cell">Описание</TableHead>
                  {showAuthor && <TableHead className="hidden md:table-cell">Кто</TableHead>}
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="w-20 text-sm text-muted-foreground">{fmtDate(t.date)}</TableCell>
                    <TableCell>
                      <CategoryChip category={t.category} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="max-w-48 truncate text-sm text-muted-foreground">
                        {t.description ?? '—'}
                      </div>
                    </TableCell>
                    {showAuthor && (
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {initials(t.userName)}
                          </span>
                          <span className="max-w-24 truncate text-sm text-muted-foreground">
                            {t.userName ?? '—'}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'font-semibold whitespace-nowrap',
                          t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
                        )}
                      >
                        {t.type === 'income' ? '+' : '−'}
                        {formatMoney(t.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          aria-label="Редактировать запись"
                          onClick={() => onEdit(t)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <DeleteTransactionButton transaction={t} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
