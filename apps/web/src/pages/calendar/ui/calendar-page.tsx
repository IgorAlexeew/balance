import { useState } from 'react'
import { addMonths, format, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import type { CalendarEventDTO } from '@balance/contracts'
import { useActiveGroup } from '@/entities/family-group'
import { EventDialog } from '@/features/event-edit'
import { CalendarMonth } from '@/widgets/calendar-month'
import { Button } from '@/shared/ui/button'
import { MonthSwitcher } from '@/shared/ui/month-switcher'

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

      <MonthSwitcher
        label={format(anchor, 'LLLL yyyy', { locale: ru })}
        onPrev={() => setAnchor((a) => subMonths(a, 1))}
        onNext={() => setAnchor((a) => addMonths(a, 1))}
        onToday={() => setAnchor(new Date())}
      />

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
