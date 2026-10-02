import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  EVENT_COLORS,
  type CalendarEventDTO,
  type EventColor,
  type EventCreateInput,
} from '@balance/contracts'
import { EVENT_COLOR_CLASSES, eventApi, eventKeys } from '@/entities/event'
import { useActiveGroup } from '@/entities/family-group'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

interface EventFormValues {
  title: string
  description: string
  allDay: boolean
  color: EventColor
  startValue: string
  endValue: string
}

/** Начальные значения формы: из события при редактировании, иначе defaultDate (или сегодня) 18:00–19:00 */
function getInitialValues(event: CalendarEventDTO | null, defaultDate: Date | null): EventFormValues {
  if (event) {
    return {
      title: event.title,
      description: event.description ?? '',
      allDay: event.allDay,
      color: event.color,
      startValue: format(parseISO(event.start), event.allDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm"),
      endValue: format(parseISO(event.end), event.allDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm"),
    }
  }
  const dayStr = format(defaultDate ?? new Date(), 'yyyy-MM-dd')
  return {
    title: '',
    description: '',
    allDay: false,
    color: 'emerald',
    startValue: `${dayStr}T18:00`,
    endValue: `${dayStr}T19:00`,
  }
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEventDTO | null
  defaultDate: Date | null
}) {
  const queryClient = useQueryClient()
  const { groupId: activeGroupId } = useActiveGroup()
  const groupId = event ? event.groupId : activeGroupId

  const initial = getInitialValues(event, defaultDate)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [color, setColor] = useState<EventColor>(initial.color)
  const [startValue, setStartValue] = useState(initial.startValue)
  const [endValue, setEndValue] = useState(initial.endValue)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: ({ groupId: targetGroupId, ...input }: EventCreateInput) =>
      event ? eventApi.update(event.id, input) : eventApi.create({ ...input, groupId: targetGroupId }),
    onSuccess: () => {
      toast.success(event ? 'Событие обновлено' : 'Событие создано')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => {
      if (!event) throw new Error('Событие не найдено')
      return eventApi.remove(event.id)
    },
    onSuccess: () => {
      toast.success('Событие удалено')
      setConfirmDelete(false)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
    onError: (e: Error) => {
      setConfirmDelete(false)
      toast.error(e.message)
    },
  })

  function handleAllDayChange(checked: boolean) {
    setAllDay(checked)
    if (checked) {
      // на «весь день» остаётся только дата
      setStartValue((v) => v.slice(0, 10))
      setEndValue((v) => v.slice(0, 10))
    } else {
      // обратно к времени: 18:00–19:00 соответствующих дат
      setStartValue((v) => `${v.slice(0, 10)}T18:00`)
      setEndValue((v) => `${v.slice(0, 10)}T19:00`)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error('Введите название события')
      return
    }
    if (!startValue || !endValue) {
      toast.error('Укажите начало и окончание события')
      return
    }
    // «Весь день» храним как дату T00:00 — T23:59 (локальное время)
    const start = allDay ? new Date(`${startValue}T00:00`) : new Date(startValue)
    const end = allDay ? new Date(`${endValue}T23:59`) : new Date(endValue)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Проверьте корректность дат события')
      return
    }
    if (end.getTime() <= start.getTime()) {
      toast.error('Окончание не может быть раньше начала')
      return
    }
    save.mutate({
      title: trimmedTitle,
      description: description.trim() || null,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      color,
      groupId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Редактирование события' : 'Новое событие'}</DialogTitle>
          <DialogDescription>
            {groupId ? 'Событие будет доступно всем членам группы.' : 'Личное событие — видно только вам.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="event-title">
              Название <span className="text-destructive">*</span>
            </Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Например, ужин с семьёй"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Описание</Label>
            <Textarea
              id="event-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Необязательные подробности"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <Label htmlFor="event-all-day" className="cursor-pointer">
              Весь день
            </Label>
            <Switch id="event-all-day" checked={allDay} onCheckedChange={handleAllDayChange} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Начало</Label>
              <Input
                id="event-start"
                type={allDay ? 'date' : 'datetime-local'}
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">Окончание</Label>
              <Input
                id="event-end"
                type={allDay ? 'date' : 'datetime-local'}
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Цвет</Label>
            <div className="flex items-center gap-2.5">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Цвет: ${EVENT_COLOR_CLASSES[c].title}`}
                  aria-pressed={color === c}
                  className={cn(
                    'size-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    color === c && 'scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background',
                  )}
                  style={{ backgroundColor: EVENT_COLOR_CLASSES[c].hex }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            {event && (
              <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Удалить событие?"
                description={`Событие «${event.title}» будет удалено безвозвратно.`}
                onConfirm={() => remove.mutate()}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                    disabled={remove.isPending}
                  >
                    {remove.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Удалить
                  </Button>
                }
              />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {event ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
