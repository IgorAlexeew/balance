'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { EVENT_COLORS, type CalendarEventDTO, type CalendarEventInput, type EventColor } from '@/lib/types'
import { cn } from '@/lib/utils'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

/** Карта классов цветов событий: чип в сетке, точка легенды, hex для заливки */
export const EVENT_COLOR_CLASSES: Record<EventColor, { chip: string; dot: string; hex: string }> = {
  emerald: {
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-l-2 border-emerald-500',
    dot: 'bg-emerald-500',
    hex: '#10b981',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-l-2 border-amber-500',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  rose: {
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-l-2 border-rose-500',
    dot: 'bg-rose-500',
    hex: '#f43f5e',
  },
  violet: {
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border-l-2 border-violet-500',
    dot: 'bg-violet-500',
    hex: '#8b5cf6',
  },
  teal: {
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-l-2 border-teal-500',
    dot: 'bg-teal-500',
    hex: '#14b8a6',
  },
  orange: {
    chip: 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border-l-2 border-orange-500',
    dot: 'bg-orange-500',
    hex: '#f97316',
  },
}

/** Названия цветов — только для aria-label кнопок выбора */
const COLOR_TITLES: Record<EventColor, string> = {
  emerald: 'Изумрудный',
  amber: 'Янтарный',
  rose: 'Розовый',
  violet: 'Фиолетовый',
  teal: 'Бирюзовый',
  orange: 'Оранжевый',
}

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
  onOpenChange: (o: boolean) => void
  event: CalendarEventDTO | null
  defaultDate: Date | null
}) {
  const queryClient = useQueryClient()
  const groupId = useAppStore((s) => s.groupId)

  const initial = getInitialValues(event, defaultDate)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [color, setColor] = useState<EventColor>(initial.color)
  const [startValue, setStartValue] = useState(initial.startValue)
  const [endValue, setEndValue] = useState(initial.endValue)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: (input: CalendarEventInput) =>
      event ? api.events.update(event.id, input) : api.events.create(input),
    onSuccess: () => {
      toast.success(event ? 'Событие обновлено' : 'Событие создано')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => {
      if (!event) throw new Error('Событие не найдено')
      return api.events.remove(event.id)
    },
    onSuccess: () => {
      toast.success('Событие удалено')
      setConfirmDelete(false)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
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
      groupId: groupId ?? null,
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
                  aria-label={`Цвет: ${COLOR_TITLES[c]}`}
                  aria-pressed={color === c}
                  className={cn(
                    'size-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    color === c && 'scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background'
                  )}
                  style={{ backgroundColor: EVENT_COLOR_CLASSES[c].hex }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            {event && (
              <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                  >
                    <Trash2 className="size-4" />
                    Удалить
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить событие?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Событие «{event.title}» будет удалено безвозвратно.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault()
                        remove.mutate()
                      }}
                      disabled={remove.isPending}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {remove.isPending && <Loader2 className="size-4 animate-spin" />}
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
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
