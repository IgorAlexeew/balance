import { useState } from 'react'
import { Plus, TrendingDown, TrendingUp, User, Users, Wallet } from 'lucide-react'
import type { TransactionDTO } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import { useBudgetSummary, useTransactions } from '@/entities/transaction'
import { AiAnalysisButton } from '@/features/budget-ai-analysis'
import { TransactionDialog } from '@/features/transaction-edit'
import { BudgetCharts } from '@/widgets/budget-charts'
import { TransactionsTable } from '@/widgets/transactions-table'
import { cn } from '@/shared/lib/cn'
import { currentMonth, formatMoney, monthTitle, shiftMonth } from '@/shared/lib/format'
import { useDialogState } from '@/shared/lib/use-dialog-state'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { MonthSwitcher } from '@/shared/ui/month-switcher'
import { Skeleton } from '@/shared/ui/skeleton'

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: string | null
  icon: typeof TrendingUp
  tone: string
}) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className={cn('size-4', tone)} />
          {title}
        </div>
        {value === null ? (
          <Skeleton className="mt-2 h-7 w-28" />
        ) : (
          <div className={cn('mt-1.5 truncate text-xl font-bold sm:text-2xl', tone)}>{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

const POSITIVE = 'text-emerald-600 dark:text-emerald-400'
const NEGATIVE = 'text-rose-600 dark:text-rose-400'

export function BudgetPage() {
  const { groupId, group } = useActiveGroup()
  const [month, setMonth] = useState(currentMonth)
  const dialog = useDialogState<TransactionDTO>()
  const transactionsQuery = useTransactions(month, groupId)
  const summary = useBudgetSummary(month, groupId).data

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Бюджет</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            {group ? <Users className="size-3.5" /> : <User className="size-3.5" />}
            <span className="truncate">{group ? group.name : 'Личные данные'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <AiAnalysisButton
            month={month}
            groupId={groupId}
            disabled={!summary || summary.totalExpense === 0}
          />
          <Button size="sm" className="gap-1.5" onClick={() => dialog.openWith()}>
            <Plus className="size-4" />
            Запись
          </Button>
        </div>
      </div>

      <MonthSwitcher
        label={monthTitle(month)}
        onPrev={() => setMonth((m) => shiftMonth(m, -1))}
        onNext={() => setMonth((m) => shiftMonth(m, 1))}
        onToday={() => setMonth(currentMonth())}
      />

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          title="Доходы"
          value={summary ? formatMoney(summary.totalIncome) : null}
          icon={TrendingUp}
          tone={POSITIVE}
        />
        <SummaryCard
          title="Расходы"
          value={summary ? formatMoney(summary.totalExpense) : null}
          icon={TrendingDown}
          tone={NEGATIVE}
        />
        <SummaryCard
          title="Баланс"
          value={summary ? formatMoney(summary.balance) : null}
          icon={Wallet}
          tone={summary && summary.balance < 0 ? NEGATIVE : POSITIVE}
        />
      </div>

      {summary && summary.totalExpense > 0 && <BudgetCharts summary={summary} />}

      <TransactionsTable
        transactions={transactionsQuery.data ?? []}
        isLoading={transactionsQuery.isLoading}
        showAuthor={groupId !== null}
        onCreate={() => dialog.openWith()}
        onEdit={dialog.openWith}
      />

      <TransactionDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        transaction={dialog.target}
      />
    </div>
  )
}
