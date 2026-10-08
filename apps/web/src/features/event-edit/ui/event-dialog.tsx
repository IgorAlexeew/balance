import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { EVENT_COLORS, type CalendarEventDTO, type EventCreateInput } from '@balance/contracts'
import { EVENT_COLOR_CLASSES, eventApi, eventKeys } from '@/entities/event'
import { useActiveGroup } from '@/entities/family-group'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { DatePicker, DateTimePicker } from '@/shared/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

/** «Весь день» храним как локальные 00:00 — 23:59 соответствующих дат */
function toRange(v: { allDay: boolean; start: string; end: string }) {
  const start = v.allDay ? new Date(`${v.start.slice(0, 10)}T00:00`) : new Date(v.start)
  const end = v.allDay ? new Date(`${v.end.slice(0, 10)}T23:59`) : new Date(v.end)
  return { start, end }
}

const formSchema = z
  .object({
    title: z.string().trim().min(1, 'Введите название события').max(200),
    description: z.string().max(2000),
    allDay: z.boolean(),
    color: z.enum(EVENT_COLORS),
    start: z.string().min(1, 'Укажите начало'),
    end: z.string().min(1, 'Укажите окончание'),
  })
  .refine(
    (v) => {
      const { start, end } = toRange(v)
      return end.getTime() > start.getTime()
    },
    { path: ['end'], message: 'Окончание должно быть позже начала' },
  )
type FormValues = z.infer<typeof formSchema>

const LOCAL_DT = "yyyy-MM-dd'T'HH:mm"

function defaults(event: CalendarEventDTO | null, defaultDate: Date | null): FormValues {
  if (event) {
    return {
      title: event.title,
      description: event.description ?? '',
      allDay: event.allDay,
      color: event.color,
      start: format(parseISO(event.start), LOCAL_DT),
      end: format(parseISO(event.end), LOCAL_DT),
    }
  }
  const day = format(defaultDate ?? new Date(), 'yyyy-MM-dd')
  return {
    title: '',
    description: '',
    allDay: false,
    color: 'emerald',
    start: `${day}T18:00`,
    end: `${day}T19:00`,
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
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(event, defaultDate),
  })
  const allDay = useWatch({ control: form.control, name: 'allDay' })

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
    mutationFn: () => eventApi.remove(event!.id),
    onSuccess: () => {
      toast.success('Событие удалено')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = (v: FormValues) => {
    const { start, end } = toRange(v)
    save.mutate({
      title: v.title.trim(),
      description: v.description.trim() || null,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: v.allDay,
      color: v.color,
      groupId,
    })
  }

  const dateField = (name: 'start' | 'end', label: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`event-${name}`}>{label}</FieldLabel>
          {allDay ? (
            <DatePicker
              id={`event-${name}`}
              value={field.value.slice(0, 10)}
              onChange={(d) => field.onChange(d ? `${d}${field.value.slice(10) || 'T00:00'}` : '')}
              invalid={fieldState.invalid}
            />
          ) : (
            <DateTimePicker
              id={`event-${name}`}
              value={field.value}
              onChange={field.onChange}
              defaultTime={name === 'start' ? '18:00' : '19:00'}
              invalid={fieldState.invalid}
            />
          )}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Редактирование события' : 'Новое событие'}</DialogTitle>
          <DialogDescription>
            {groupId
              ? 'Событие будет доступно всем участникам группы.'
              : 'Личное событие — видно только вам.'}
          </DialogDescription>
        </DialogHeader>

        <form noValidate className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <FieldGroup className="gap-4">
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="event-title">Название</FieldLabel>
                  <Input
                    {...field}
                    id="event-title"
                    maxLength={200}
                    placeholder="Например, ужин с семьёй"
                    aria-invalid={fieldState.invalid}
                    autoFocus
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="event-description">Описание</FieldLabel>
                  <Textarea
                    {...field}
                    id="event-description"
                    rows={2}
                    maxLength={2000}
                    placeholder="Необязательно"
                  />
                </Field>
              )}
            />

            <Controller
              name="allDay"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border px-3 py-2.5">
                  <FieldLabel htmlFor="event-all-day" className="flex-1 cursor-pointer">
                    Весь день
                  </FieldLabel>
                  <Switch id="event-all-day" checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />

            {dateField('start', 'Начало')}
            {dateField('end', 'Окончание')}

            <Controller
              name="color"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Цвет</FieldLabel>
                  <div className="flex items-center gap-2.5">
                    {EVENT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => field.onChange(c)}
                        aria-label={`Цвет: ${EVENT_COLOR_CLASSES[c].title}`}
                        aria-pressed={field.value === c}
                        className={cn(
                          'size-7 rounded-full transition-transform hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                          field.value === c &&
                            'scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background',
                        )}
                        style={{ backgroundColor: EVENT_COLOR_CLASSES[c].hex }}
                      />
                    ))}
                  </div>
                </Field>
              )}
            />
          </FieldGroup>

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
                    {remove.isPending ? <Spinner /> : <Trash2 className="size-4" />}
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
              {save.isPending && <Spinner />}
              {event ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
