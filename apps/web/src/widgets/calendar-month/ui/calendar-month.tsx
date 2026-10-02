import {
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
} from 'date-fns'
import { EVENT_COLORS, type CalendarEventDTO } from '@balance/contracts'
import { EVENT_COLOR_CLASSES, useEvents } from '@/entities/event'
import { useTasks } from '@/entities/task'
import { cn } from '@/shared/lib/cn'
import { fmtTime, WEEKDAY_SHORT } from '@/shared/lib/format'
import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

const MAX_EVENTS_PER_DAY = 3

function monthGrid(anchor: Date) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  return { start, end, days: eachDayOfInterval({ start, end }) }
}

/** Сетка месяца: события и ближайший дедлайн незавершённой задачи по дням */
export function CalendarMonth({
  anchor,
  groupId,
  onDayClick,
  onEventClick,
}: {
  anchor: Date
  groupId: string | null
  onDayClick: (day: Date) => void
  onEventClick: (event: CalendarEventDTO) => void
}) {
  const { start, end, days } = monthGrid(anchor)
  const eventsQuery = useEvents(start, end, groupId)
  const tasksQuery = useTasks('todo', groupId)

  const events = (eventsQuery.data ?? []).map((ev) => ({
    ev,
    start: parseISO(ev.start),
    end: parseISO(ev.end),
  }))
  const eventsByDay = new Map<string, CalendarEventDTO[]>()
  for (const day of days) {
    const dayStart = startOfDay(day).getTime()
    const dayEnd = endOfDay(day).getTime()
    const list = events
      .filter((e) => e.start.getTime() <= dayEnd && e.end.getTime() > dayStart)
      .map((e) => e.ev)
    if (list.length) eventsByDay.set(format(day, 'yyyy-MM-dd'), list)
  }

  const deadlineByDay = new Map<string, string>()
  for (const task of tasksQuery.data ?? []) {
    if (!task.deadline) continue
    const key = format(parseISO(task.deadline), 'yyyy-MM-dd')
    if (!deadlineByDay.has(key)) deadlineByDay.set(key, task.title)
  }

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-2 sm:p-4">
        <div className="grid grid-cols-7">
          {WEEKDAY_SHORT.map((label) => (
            <div key={label} className="py-1 text-center text-xs font-medium text-muted-foreground">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            if (eventsQuery.isLoading) {
              return (
                <div
                  key={key}
                  className="m-0.5 min-h-[84px] rounded-lg border border-border/60 p-1 sm:min-h-[112px] sm:p-1.5"
                >
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="mt-2 h-4 w-4/5 rounded-sm" />
                </div>
              )
            }
            const dayEvents = eventsByDay.get(key) ?? []
            const deadlineTitle = deadlineByDay.get(key)
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => onDayClick(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onDayClick(day)
                  }
                }}
                aria-label={`Добавить событие на ${format(day, 'd.MM')}`}
                className={cn(
                  'm-0.5 flex min-h-[84px] cursor-pointer flex-col gap-0.5 rounded-lg border border-border/60 p-1 transition-colors hover:bg-accent/40 sm:min-h-[112px] sm:p-1.5',
                  !isSameMonth(day, anchor) && 'opacity-40',
                )}
              >
                <span
                  className={cn(
                    'text-xs font-medium',
                    isToday(day) &&
                      'grid size-6 place-items-center rounded-full bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>

                {dayEvents.slice(0, MAX_EVENTS_PER_DAY).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    title={ev.allDay ? ev.title : `${fmtTime(ev.start)}–${fmtTime(ev.end)} · ${ev.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(ev)
                    }}
                    className={cn(
                      'w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight',
                      EVENT_COLOR_CLASSES[ev.color].chip,
                    )}
                  >
                    {ev.allDay ? ev.title : `${fmtTime(ev.start)} ${ev.title}`}
                  </button>
                ))}
                {dayEvents.length > MAX_EVENTS_PER_DAY && (
                  <span className="mt-0.5 text-center text-[10px] text-muted-foreground">
                    Ещё {dayEvents.length - MAX_EVENTS_PER_DAY}
                  </span>
                )}
                {deadlineTitle && (
                  <span
                    title={`Задача: ${deadlineTitle}`}
                    className="w-full truncate rounded border-l-2 border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  >
                    Задача: {deadlineTitle}
                  </span>
                )}
              </div>
            )
          })}
        </div>

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
  )
}
