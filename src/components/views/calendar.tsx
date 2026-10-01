'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { api } from '@/lib/api'
import { fmtTime, WEEKDAY_LABELS } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import { EVENT_COLORS, type CalendarEventDTO, type TaskDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EVENT_COLOR_CLASSES, EventDialog } from '@/components/event-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CalendarView() {
  const groupId = useAppStore((s) => s.groupId)

  const [anchor, setAnchor] = useState(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEventDTO | null>(null)
  const [pendingDate, setPendingDate] = useState<Date | null>(null)

  const scope = groupId ?? 'personal'
  const monthKey = format(anchor, 'yyyy-MM')
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const groupsQ = useQuery({ queryKey: ['family'], queryFn: api.family.list })
  const activeGroup = groupsQ.data?.find((g) => g.id === groupId) ?? null

  const eventsQ = useQuery({
    queryKey: ['events', 'cal', monthKey, scope],
    queryFn: () =>
      api.events.list({
        from: gridStart.toISOString(),
        to: gridEnd.toISOString(),
        groupId,
      }),
  })

  const tasksQ = useQuery({
    queryKey: ['tasks', 'cal', scope],
    queryFn: () => api.tasks.list({ status: 'todo', scope }),
  })

  const events = eventsQ.data ?? []
  const todoTasks = tasksQ.data ?? []

  // Разложение событий по дням: событие показывается на каждом дне, который оно покрывает
  const parsedEvents = events.map((ev) => ({
    ev,
    start: parseISO(ev.start).getTime(),
    end: parseISO(ev.end).getTime(),
  }))
  const eventsByDay: Record<string, CalendarEventDTO[]> = {}
  for (const day of days) {
    const key = format(day, 'yyyy-MM-dd')
    const dayStart = startOfDay(day).getTime()
    const dayEnd = endOfDay(day).getTime()
    for (const { ev, start: evStart, end: evEnd } of parsedEvents) {
      if (evStart <= dayEnd && evEnd > dayStart) {
        const list = eventsByDay[key] ?? (eventsByDay[key] = [])
        list.push(ev)
      }
    }
  }

  // Дедлайны задач по дням: показываем первую (самую раннюю) незавершённую задачу дня
  const deadlineTasksByDay: Record<string, TaskDTO> = {}
  for (const task of todoTasks) {
    if (!task.deadline) continue
    const key = format(parseISO(task.deadline), 'yyyy-MM-dd')
    if (!deadlineTasksByDay[key]) deadlineTasksByDay[key] = task
  }

  function openCreate(day: Date) {
    setEditing(null)
    setPendingDate(day)
    setDialogOpen(true)
  }

  function openEdit(ev: CalendarEventDTO) {
    setEditing(ev)
    setPendingDate(null)
    setDialogOpen(true)
  }

  // При закрытии сбрасываем цель диалога, чтобы повторное открытие того же дня
  // сменило key и форма пересоздалась с чистыми значениями
  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditing(null)
      setPendingDate(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Календарь</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeGroup ? `События группы «${activeGroup.name}»` : 'Личные события'}
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => openCreate(new Date())}>
          <Plus className="size-4" />
          Событие
        </Button>
      </div>

      {/* Панель месяца */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Предыдущий месяц"
            onClick={() => setAnchor(subMonths(anchor, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[176px] text-center text-base font-semibold capitalize select-none">
            {format(anchor, 'LLLL yyyy', { locale: ru })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Следующий месяц"
            onClick={() => setAnchor(addMonths(anchor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Сегодня
        </Button>
      </div>

      {/* Сетка месяца */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-2 sm:p-4">
            {/* Дни недели */}
            <div className="grid grid-cols-7">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>

            {/* Дни */}
            {eventsQ.isLoading ? (
              <div className="grid grid-cols-7">
                {days.map((day) => (
                  <div
                    key={format(day, 'yyyy-MM-dd')}
                    className="m-0.5 min-h-[84px] rounded-lg border border-border/60 p-1 sm:min-h-[112px] sm:p-1.5"
                  >
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="mt-2 h-4 w-4/5 rounded-sm" />
                    <Skeleton className="mt-1 h-4 w-3/5 rounded-sm" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayEvents = eventsByDay[key] ?? []
                  const deadlineTask = deadlineTasksByDay[key]
                  return (
                    <div
                      key={key}
                      onClick={() => openCreate(day)}
                      className={cn(
                        'm-0.5 flex min-h-[84px] cursor-pointer flex-col gap-0.5 rounded-lg border border-border/60 p-1 transition-colors hover:bg-accent/40 sm:min-h-[112px] sm:p-1.5',
                        !isSameMonth(day, anchor) && 'opacity-40'
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isToday(day) &&
                            'grid size-6 place-items-center rounded-full bg-primary font-semibold text-primary-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {dayEvents.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          title={ev.allDay ? ev.title : `${fmtTime(ev.start)}–${fmtTime(ev.end)} · ${ev.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(ev)
                          }}
                          className={cn(
                            'w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight',
                            EVENT_COLOR_CLASSES[ev.color].chip
                          )}
                        >
                          {ev.allDay ? ev.title : `${fmtTime(ev.start)} ${ev.title}`}
                        </button>
                      ))}

                      {dayEvents.length > 3 && (
                        <span className="mt-0.5 text-center text-[10px] text-muted-foreground">
                          Ещё {dayEvents.length - 3}
                        </span>
                      )}

                      {deadlineTask && (
                        <span
                          title={`Задача: ${deadlineTask.title}`}
                          className="w-full truncate rounded border-l-2 border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        >
                          Задача: {deadlineTask.title}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Легенда */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {EVENT_COLORS.map((c) => (
                  <span key={c} className={cn('size-2 rounded-full', EVENT_COLOR_CLASSES[c].dot)} />
                ))}
                Событие
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-amber-400" />
                Дедлайн задачи
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <EventDialog
        key={editing?.id ?? pendingDate?.toDateString() ?? 'new'}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        event={editing}
        defaultDate={pendingDate}
      />
    </div>
  )
}
