'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Markdown from 'react-markdown'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Tags,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TransactionDialog } from '@/components/transaction-dialog'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { getCategory } from '@/lib/categories'
import {
  currentMonth,
  fmtDate,
  fmtDayMonth,
  fmtMoney,
  fmtMoneyShort,
  initials,
  monthTitle,
  shiftMonth,
} from '@/lib/format'
import { useAppStore } from '@/lib/store'
import type { TransactionDTO } from '@/lib/types'

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#84cc16']

interface PieDatum {
  name: string
  total: number
  color: string
}

interface DayDatum {
  day: number
  income: number
  expense: number
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { payload?: PieDatum }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0]?.payload
  if (!datum) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">{datum.name}</div>
      <div className="text-muted-foreground">{fmtMoney(datum.total)}</div>
    </div>
  )
}

function DayTooltip({
  active,
  payload,
  month,
}: {
  active?: boolean
  payload?: { payload?: DayDatum }[]
  month: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0]?.payload
  if (!datum) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">{fmtDayMonth(`${month}-${String(datum.day).padStart(2, '0')}`)}</div>
      <div className="text-muted-foreground">Расходы: {fmtMoney(datum.expense)}</div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  title: string
  value: string
  icon: typeof TrendingUp
  tone: string
  loading: boolean
}) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className={cn('size-4', tone)} />
          {title}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-28" />
        ) : (
          <div className={cn('mt-1.5 truncate text-xl font-bold sm:text-2xl', tone)}>{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

export function BudgetView() {
  const queryClient = useQueryClient()
  const groupId = useAppStore((s) => s.groupId)
  const [month, setMonth] = useState(currentMonth())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionDTO | null>(null)
  const [aiOpen, setAiOpen] = useState(false)

  const { data: groups = [] } = useQuery({ queryKey: ['family'], queryFn: api.family.list })
  const activeGroup = groups.find((g) => g.id === groupId) ?? null
  const scope = groupId ?? 'personal'

  const txQ = useQuery({
    queryKey: ['transactions', month, scope],
    queryFn: () => api.transactions.list({ month, groupId }),
  })
  const summaryQ = useQuery({
    queryKey: ['summary', month, scope],
    queryFn: () => api.budget.summary({ month, groupId }),
  })

  const summary = summaryQ.data
  const transactions = txQ.data ?? []
  const monthLabel = capitalizeFirst(monthTitle(month))

  // Топ-7 категорий расходов + «Прочее» (byCategory уже отсортирован по total desc)
  const expenseCats = (summary?.byCategory ?? []).filter((c) => c.type === 'expense')
  const pieTop = expenseCats.slice(0, 7)
  const pieRest = expenseCats.slice(7)
  const pieData: PieDatum[] = pieTop.map((c, i) => ({
    name: c.category,
    total: c.total,
    color: PIE_COLORS[i] ?? PIE_COLORS[PIE_COLORS.length - 1],
  }))
  if (pieRest.length > 0) {
    pieData.push({
      name: 'Прочее',
      total: pieRest.reduce((sum, c) => sum + c.total, 0),
      color: PIE_COLORS[PIE_COLORS.length - 1],
    })
  }
  const dayTicks = (summary?.byDay ?? []).filter((d) => d.day % 3 === 1).map((d) => d.day)
  const hasExpenses = (summary?.totalExpense ?? 0) > 0

  const removeTx = useMutation({
    mutationFn: (id: string) => api.transactions.remove(id),
    onSuccess: () => {
      toast.success('Запись удалена')
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Эндпоинт может быть ещё не готов — ошибку гасим тостом, UI не падает
  const aiAnalysis = useMutation({
    mutationFn: () => api.budget.aiAnalysis({ month, groupId }),
    onError: () => toast.error('ИИ-анализ временно недоступен'),
  })

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (t: TransactionDTO) => {
    setEditing(t)
    setDialogOpen(true)
  }
  const openAi = () => {
    aiAnalysis.mutate()
    setAiOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Бюджет</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            {activeGroup ? <Users className="size-3.5" /> : <User className="size-3.5" />}
            <span className="truncate">{activeGroup ? activeGroup.name : 'Личные данные'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={openAi}
            disabled={summary?.totalExpense === 0}
            title={summary?.totalExpense === 0 ? 'Сначала добавьте расходы' : undefined}
          >
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">ИИ-анализ покупок</span>
            <span className="sm:hidden">ИИ-анализ</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="size-4" />
            Запись
          </Button>
        </div>
      </div>

      {/* Навигация по месяцам */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Предыдущий месяц"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-40 text-center text-sm font-semibold">{monthLabel}</div>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Следующий месяц"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
          Сегодня
        </Button>
      </div>

      {/* Сводка месяца */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          title="Доходы"
          value={summary ? fmtMoney(summary.totalIncome) : ''}
          icon={TrendingUp}
          tone="text-emerald-600 dark:text-emerald-400"
          loading={!summary}
        />
        <SummaryCard
          title="Расходы"
          value={summary ? fmtMoney(summary.totalExpense) : ''}
          icon={TrendingDown}
          tone="text-rose-600 dark:text-rose-400"
          loading={!summary}
        />
        <SummaryCard
          title="Баланс"
          value={summary ? fmtMoney(summary.balance) : ''}
          icon={Wallet}
          tone={
            summary && summary.balance >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }
          loading={!summary}
        />
      </div>

      {/* Графики */}
      {hasExpenses && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="rounded-xl border shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tags className="size-4.5 text-primary" />
                Расходы по категориям
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto shrink-0 font-medium">{fmtMoney(d.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="size-4.5 text-primary" />
                Динамика расходов
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={summary?.byDay ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.3} />
                  <XAxis
                    dataKey="day"
                    ticks={dayTicks}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                  />
                  <YAxis
                    width={46}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    tickFormatter={(v: number) => fmtMoneyShort(v)}
                  />
                  <Tooltip content={<DayTooltip month={month} />} />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Расходы"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fill="#f43f5e33"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Таблица операций */}
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
          {txQ.isLoading ? (
            <div className="space-y-2 p-4 pt-1">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto mb-2 size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">В этом месяце записей пока нет</p>
              <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openCreate}>
                <Plus className="size-3.5" />
                Добавить запись
              </Button>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto rounded-b-xl [&>div]:overflow-visible">
              <Table className="[&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4">
                <TableHeader className="sticky top-0 z-10 bg-background [&_th]:bg-background">
                  <TableRow>
                    <TableHead className="w-20">Дата</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="hidden sm:table-cell">Описание</TableHead>
                    {groupId !== null && <TableHead className="hidden md:table-cell">Кто</TableHead>}
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const cat = getCategory(t.category)
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="w-20 text-sm text-muted-foreground">{fmtDate(t.date)}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex max-w-40 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                              cat.chipClass
                            )}
                          >
                            <span className="shrink-0 leading-none">{cat.icon}</span>
                            <span className="min-w-0 truncate">{t.category}</span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="max-w-48 truncate text-sm text-muted-foreground">
                            {t.description ?? '—'}
                          </div>
                        </TableCell>
                        {groupId !== null && (
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
                              'whitespace-nowrap font-semibold',
                              t.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            )}
                          >
                            {t.type === 'income' ? '+' : '−'}
                            {fmtMoney(t.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              aria-label="Редактировать запись"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                                  aria-label="Удалить запись"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Запись «{t.category}» за {fmtDate(t.date)} будет удалена безвозвратно.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                                    onClick={() => removeTx.mutate(t.id)}
                                  >
                                    Удалить
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог записи */}
      <TransactionDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
      />

      {/* Диалог ИИ-анализа */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4.5 text-primary" />
              ИИ-анализ покупок · {monthLabel}
            </DialogTitle>
            <DialogDescription className="sr-only">Анализ расходов за {monthLabel}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {aiAnalysis.isPending ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm">Анализируем покупки, это займёт до минуты…</p>
              </div>
            ) : aiAnalysis.data ? (
              <Markdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-2 mt-4 text-base font-semibold text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 mt-4 text-base font-semibold text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
                  ),
                  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-sm">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                }}
              >
                {aiAnalysis.data.analysis}
              </Markdown>
            ) : (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Не удалось загрузить анализ. Попробуйте ещё раз.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={openAi}>
                  Повторить
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
