'use client'

import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ListTodo,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { addDays, endOfDay, isSameDay, parseISO, startOfDay } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { getCategory } from '@/lib/categories'
import {
  currentMonth,
  fmtMoney,
  fmtTime,
  greeting,
  humanizeReminder,
  isOverdueTask,
  PRIORITY_CHIP_CLASSES,
  PRIORITY_LABELS,
  todayTitle,
} from '@/lib/format'
import { useAppStore } from '@/lib/store'
import type { TaskDTO } from '@/lib/types'

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  onClick,
}: {
  title: string
  value: string
  hint?: string
  icon: typeof ListTodo
  tone?: 'default' | 'rose' | 'emerald' | 'amber'
  onClick?: () => void
}) {
  const toneClasses = {
    default: 'text-foreground',
    rose: 'text-rose-600 dark:text-rose-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
  }[tone]
  return (
    <motion.div variants={cardVariants}>
      <Card
        className="rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={onClick}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium">{title}</div>
              <div className={cn('text-2xl font-bold mt-1.5 truncate', toneClasses)}>{value}</div>
              {hint && <div className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</div>}
            </div>
            <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Icon className="size-4.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TaskRow({ task }: { task: TaskDTO }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () =>
      api.tasks.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex items-start gap-3 py-2.5">
      <Checkbox
        checked={task.status === 'done'}
        onCheckedChange={() => toggle.mutate()}
        disabled={toggle.isPending}
        className="mt-0.5"
        aria-label={`Отметить задачу «${task.title}»`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug truncate">{task.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {task.deadline && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {fmtTime(task.deadline)}
            </span>
          )}
          <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium', PRIORITY_CHIP_CLASSES[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.assigneeName && (
            <span className="text-[11px] text-muted-foreground">→ {task.assigneeName}</span>
          )}
        </div>
      </div>
      {task.reminder && (
        <span title={humanizeReminder(task.reminder)} className="text-muted-foreground shrink-0 mt-0.5">
          <BellRing className="size-3.5" />
        </span>
      )}
    </div>
  )
}

export function DashboardView() {
  const { data: session } = useSession()
  const groupId = useAppStore((s) => s.groupId)
  const setView = useAppStore((s) => s.setView)
  const month = currentMonth()

  const tasksQ = useQuery({
    queryKey: ['tasks', 'all', groupId ?? 'personal'],
    queryFn: () => api.tasks.list({ status: 'all', scope: groupId ?? 'personal' }),
  })
  const eventsQ = useQuery({
    queryKey: ['events', 'dash', groupId ?? 'personal'],
    queryFn: () =>
      api.events.list({
        from: startOfDay(new Date()).toISOString(),
        to: endOfDay(addDays(new Date(), 13)).toISOString(),
        groupId,
      }),
  })
  const summaryQ = useQuery({
    queryKey: ['summary', month, groupId ?? 'personal'],
    queryFn: () => api.budget.summary({ month, groupId }),
  })
  const txQ = useQuery({
    queryKey: ['transactions', month, groupId ?? 'personal'],
    queryFn: () => api.transactions.list({ month, groupId }),
  })

  const tasks = tasksQ.data ?? []
  const today = new Date()

  const todayTasks = tasks
    .filter((t) => t.status === 'todo' && t.deadline && isSameDay(parseISO(t.deadline), today))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
  const overdueTasks = tasks.filter(isOverdueTask)
  const doneToday = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && isSameDay(parseISO(t.completedAt), today)
  )
  const todayEvents = (eventsQ.data ?? []).filter((e) => isSameDay(parseISO(e.start), today))
  const upcomingEvents = (eventsQ.data ?? [])
    .filter((e) => parseISO(e.start).getTime() >= startOfDay(today).getTime())
    .slice(0, 5)
  const recentTx = (txQ.data ?? []).slice(0, 6)
  const summary = summaryQ.data

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {session?.user?.name?.split(' ')[0] ?? 'друг'}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{todayTitle()}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setView('tasks')}>
            <Plus className="size-4" />
            Задача
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setView('budget')}>
            <Wallet className="size-4" />
            Трата
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 hidden sm:inline-flex" onClick={() => setView('calendar')}>
            <CalendarDays className="size-4" />
            Событие
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
      >
        <StatCard
          title="Задачи на сегодня"
          value={String(todayTasks.length)}
          hint={doneToday.length > 0 ? `Выполнено сегодня: ${doneToday.length}` : 'Планируйте день'}
          icon={ListTodo}
          onClick={() => setView('tasks')}
        />
        <StatCard
          title="Просрочено"
          value={String(overdueTasks.length)}
          hint={overdueTasks.length > 0 ? 'Требуют внимания' : 'Всё под контролем'}
          icon={AlarmClock}
          tone={overdueTasks.length > 0 ? 'rose' : 'emerald'}
          onClick={() => setView('tasks')}
        />
        <StatCard
          title="Баланс месяца"
          value={summary ? fmtMoney(summary.balance) : '—'}
          hint={
            summary
              ? `+${fmtMoney(summary.totalIncome)} / −${fmtMoney(summary.totalExpense)}`
              : 'Доходы и расходы'
          }
          icon={CircleDollarSign}
          tone={summary ? (summary.balance >= 0 ? 'emerald' : 'rose') : 'default'}
          onClick={() => setView('budget')}
        />
        <StatCard
          title="События сегодня"
          value={String(todayEvents.length)}
          hint={todayEvents[0]?.title ?? 'Ближайшие события недели'}
          icon={CalendarDays}
          tone="amber"
          onClick={() => setView('calendar')}
        />
      </motion.div>

      {/* Контент */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* Задачи */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="size-4.5 text-primary" />
                  Задачи на сегодня
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setView('tasks')}>
                  Все задачи
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {tasksQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : todayTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">На сегодня задач нет — свободный день!</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setView('tasks')}>
                    <Plus className="size-3.5" />
                    Добавить задачу
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {todayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* События */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.08 }}>
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="size-4.5 text-primary" />
                  Ближайшие события
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setView('calendar')}>
                  Календарь
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {eventsQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarDays className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Событий на две недели вперёд нет</p>
                </div>
              ) : (
                <div className="divide-y max-h-72 overflow-y-auto">
                  {upcomingEvents.map((e) => {
                    const d = parseISO(e.start)
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-2.5">
                        <div className="w-12 shrink-0 text-center">
                          <div className="text-[10px] uppercase text-muted-foreground font-medium">
                            {new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(d)}
                          </div>
                          <div className="text-lg font-bold leading-none">{d.getDate()}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{e.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.allDay ? 'Весь день' : `${fmtTime(e.start)}–${fmtTime(e.end)}`}
                            {e.userName ? ` · ${e.userName}` : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Просроченные */}
        {overdueTasks.length > 0 && (
          <motion.div variants={cardVariants} initial="hidden" animate="visible">
            <Card className="rounded-xl border-rose-200 dark:border-rose-900 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlarmClock className="size-4.5" />
                  Просроченные задачи
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="divide-y max-h-64 overflow-y-auto">
                  {overdueTasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Последние траты */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.08 }}>
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="size-4.5 text-primary" />
                  Последние траты
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setView('budget')}>
                  Бюджет
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {txQ.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : recentTx.length === 0 ? (
                <div className="py-8 text-center">
                  <Wallet className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">В этом месяце записей пока нет</p>
                </div>
              ) : (
                <div className="divide-y max-h-72 overflow-y-auto">
                  {recentTx.map((t) => {
                    const cat = getCategory(t.category)
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-2.5">
                        <span className={cn('size-8 rounded-lg grid place-items-center text-base shrink-0', cat.chipClass)}>
                          {cat.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{t.category}</div>
                          {t.description && (
                            <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                          )}
                        </div>
                        <div className={cn('text-sm font-semibold shrink-0 flex items-center gap-1', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
                          {t.type === 'income' ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5 text-muted-foreground" />}
                          {t.type === 'income' ? '+' : '−'}
                          {fmtMoney(t.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
