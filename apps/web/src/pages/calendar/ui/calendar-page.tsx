import { useState } from 'react'
import { addMonths, format, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { CalendarEventDTO } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import { EventDialog } from '@/features/event-edit'
import { CalendarMonth } from '@/widgets/calendar-month'
import { Button } from '@/shared/ui/button'

export function CalendarPage() {
  const { groupId, group } = useActiveGroup()
  const [anchor, setAnchor] = useState(() => new Date())
  const [dialog, setDialog] = useState<{
    open: boolean
    event: CalendarEventDTO | null
    date: Date | null
    key: number
  }>({ open: false, event: null, date: null, key: 0 })

  const openDialog = (event: CalendarEventDTO | null, date: Date | null) =>
    setDialog((d) => ({ open: true, event, date, key: d.key + 1 }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Календарь</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {group ? `События группы «${group.name}»` : 'Личные события'}
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => openDialog(null, new Date())}>
          <Plus className="size-4" />
          Событие
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Предыдущий месяц"
            onClick={() => setAnchor((a) => subMonths(a, 1))}
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
            onClick={() => setAnchor((a) => addMonths(a, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Сегодня
        </Button>
      </div>

      <CalendarMonth
        anchor={anchor}
        groupId={groupId}
        onDayClick={(day) => openDialog(null, day)}
        onEventClick={(ev) => openDialog(ev, null)}
      />

      <EventDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        event={dialog.event}
        defaultDate={dialog.date}
      />
    </div>
  )
}
