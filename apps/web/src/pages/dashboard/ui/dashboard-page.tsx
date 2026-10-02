import type { ReactNode } from 'react'
import { addDays, endOfDay, isSameDay, parseISO, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import {
  AlarmClock,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ListTodo,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router'
import type { TaskDTO, TransactionDTO } from '@balance/contracts'
import { useEvents } from '@/entities/event'
import { useActiveGroup } from '@/entities/family-group'
import { useViewer } from '@/entities/session'
import { isOverdueTask, useTasks } from '@/entities/task'
import { CategoryIcon, useBudgetSummary, useTransactions } from '@/entities/transaction'
import { TaskDialog } from '@/features/task-edit'
import { TransactionDialog } from '@/features/transaction-edit'
import { TaskRow } from '@/widgets/task-list'
import { cn } from '@/shared/lib/cn'
import { routes } from '@/shared/config'
import { currentMonth, fmtTime, formatMoney, greeting, todayTitle } from '@/shared/lib/format'
import { useDialogState } from '@/shared/lib/use-dialog-state'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { Skeleton } from '@/shared/ui/skeleton'

const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }
const TONES = {
  default: 'text-foreground',
  rose: 'text-rose-600 dark:text-rose-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
}

function StatCard(props: {
  title: string
  value: string
  hint: string
  icon: typeof ListTodo
  tone?: keyof typeof TONES
  to: string
}) {
  const { title, value, hint, icon: Icon, tone = 'default', to } = props
  return (
    <motion.div variants={fadeUp}>
      <Link
        to={to}
        className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Card className="rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{title}</div>
                <div className={cn('mt-1.5 truncate text-2xl font-bold', TONES[tone])}>{value}</div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</div>
              </div>
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

function Section(props: {
  title: string
  icon: typeof ListTodo
  link?: { to: string; label: string }
  children: ReactNode
}) {
  const { title, icon: Icon, link, children } = props
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="size-4.5 text-primary" />
              {title}
            </CardTitle>
            {link && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
                <Link to={link.to}>
                  {link.label}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">{children}</CardContent>
      </Card>
    </motion.div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function TransactionLine({ t }: { t: TransactionDTO }) {
  const income = t.type === 'income'
  return (
    <div className="flex items-center gap-3 py-2.5">
      <CategoryIcon category={t.category} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{t.category}</div>
        {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
      </div>
      <div
        className={cn(
          'flex shrink-0 items-center gap-1 text-sm font-semibold',
          income ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
        )}
      >
        {income ? (
          <TrendingUp className="size-3.5" />
        ) : (
          <TrendingDown className="size-3.5 text-muted-foreground" />
        )}
        {income ? '+' : '−'}
        {formatMoney(t.amount)}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: viewer } = useViewer()
  const { groupId } = useActiveGroup()
  const month = currentMonth()
  const now = new Date()

  const taskDialog = useDialogState<TaskDTO>()
  const txDialog = useDialogState<TransactionDTO>()

  const tasksQuery = useTasks('all', groupId)
  const eventsQuery = useEvents(startOfDay(now), endOfDay(addDays(now, 13)), groupId)
  const summary = useBudgetSummary(month, groupId).data
  const transactionsQuery = useTransactions(month, groupId)

  const tasks = tasksQuery.data ?? []
  const todayTasks = tasks.filter(
    (t) => t.status === 'todo' && t.deadline && isSameDay(parseISO(t.deadline), now),
  )
  const overdueTasks = tasks.filter((t) => isOverdueTask(t) && !todayTasks.includes(t))
  const doneToday = tasks.filter((t) => t.completedAt && isSameDay(parseISO(t.completedAt), now)).length
  const events = eventsQuery.data ?? []
  const todayEvents = events.filter((e) => isSameDay(parseISO(e.start), now))
  const recentTransactions = (transactionsQuery.data ?? []).slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting(now)}, {viewer?.name?.split(' ')[0] ?? 'друг'}!
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">{todayTitle()}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => taskDialog.openWith()}>
            <Plus className="size-4" />
            Задача
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => txDialog.openWith()}>
            <Wallet className="size-4" />
            Трата
          </Button>
        </div>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        <StatCard
          title="Задачи на сегодня"
          value={String(todayTasks.length)}
          hint={doneToday > 0 ? `Выполнено сегодня: ${doneToday}` : 'Планируйте день'}
          icon={ListTodo}
          to={routes.tasks}
        />
        <StatCard
          title="Просрочено"
          value={String(overdueTasks.length)}
          hint={overdueTasks.length > 0 ? 'Требуют внимания' : 'Всё под контролем'}
          icon={AlarmClock}
          tone={overdueTasks.length > 0 ? 'rose' : 'emerald'}
          to={routes.tasks}
        />
        <StatCard
          title="Баланс месяца"
          value={summary ? formatMoney(summary.balance) : '—'}
          hint={
            summary
              ? `+${formatMoney(summary.totalIncome)} / −${formatMoney(summary.totalExpense)}`
              : 'Доходы и расходы'
          }
          icon={CircleDollarSign}
          tone={summary ? (summary.balance >= 0 ? 'emerald' : 'rose') : 'default'}
          to={routes.budget}
        />
        <StatCard
          title="События сегодня"
          value={String(todayEvents.length)}
          hint={todayEvents[0]?.title ?? 'Ближайшие события'}
          icon={CalendarDays}
          tone="amber"
          to={routes.calendar}
        />
      </motion.div>

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-2">
        <Section title="Задачи на сегодня" icon={ListTodo} link={{ to: routes.tasks, label: 'Все задачи' }}>
          {tasksQuery.isLoading ? (
            <ListSkeleton />
          ) : todayTasks.length === 0 ? (
            <EmptyState
              className="p-4 md:p-4"
              icon={CheckCircle2}
              title="На сегодня задач нет — свободный день!"
            />
          ) : (
            <div className="divide-y">
              {todayTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Ближайшие события"
          icon={CalendarDays}
          link={{ to: routes.calendar, label: 'Календарь' }}
        >
          {eventsQuery.isLoading ? (
            <ListSkeleton />
          ) : events.length === 0 ? (
            <EmptyState className="p-4 md:p-4" icon={CalendarDays} title="Событий на две недели вперёд нет" />
          ) : (
            <div className="max-h-72 divide-y overflow-y-auto">
              {events.slice(0, 5).map((e) => {
                const d = parseISO(e.start)
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase">
                        {new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(d)}
                      </div>
                      <div className="text-lg leading-none font-bold">{d.getDate()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.allDay ? 'Весь день' : `${fmtTime(e.start)}–${fmtTime(e.end)}`}
                        {groupId && e.userName ? ` · ${e.userName}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {overdueTasks.length > 0 && (
          <Section title="Просроченные задачи" icon={AlarmClock}>
            <div className="max-h-64 divide-y overflow-y-auto">
              {overdueTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </Section>
        )}

        <Section title="Последние операции" icon={Wallet} link={{ to: routes.budget, label: 'Бюджет' }}>
          {transactionsQuery.isLoading ? (
            <ListSkeleton />
          ) : recentTransactions.length === 0 ? (
            <EmptyState className="p-4 md:p-4" icon={Wallet} title="В этом месяце записей пока нет" />
          ) : (
            <div className="max-h-72 divide-y overflow-y-auto">
              {recentTransactions.map((t) => (
                <TransactionLine key={t.id} t={t} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <TaskDialog
        key={`task-${taskDialog.key}`}
        open={taskDialog.open}
        onOpenChange={taskDialog.setOpen}
        task={null}
      />
      <TransactionDialog
        key={`tx-${txDialog.key}`}
        open={txDialog.open}
        onOpenChange={txDialog.setOpen}
        transaction={null}
      />
    </div>
  )
}
