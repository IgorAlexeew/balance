import { useState } from 'react'
import { format, parse } from 'date-fns'
import { ru } from 'react-day-picker/locale'
import { CalendarIcon, XIcon } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { Button } from './button'
import { Calendar } from './calendar'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const DATE_FORMAT = 'yyyy-MM-dd'

function toDate(value: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value.slice(0, 10), DATE_FORMAT, new Date())
  return Number.isNaN(d.getTime()) ? undefined : d
}

interface DatePickerProps {
  id?: string
  /** YYYY-MM-DD или пустая строка */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  clearable?: boolean
  invalid?: boolean
  className?: string
}

/** Выбор даты: значение — строка YYYY-MM-DD (локальная календарная дата) */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Выберите дату',
  clearable,
  invalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            className={cn('min-w-0 flex-1 justify-start font-normal', !selected && 'text-muted-foreground')}
          >
            <CalendarIcon className="size-4" />
            <span className="truncate">
              {selected ? format(selected, 'd MMMM yyyy', { locale: ru }) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            locale={ru}
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            onSelect={(d) => {
              if (d) onChange(format(d, DATE_FORMAT))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button type="button" variant="ghost" size="icon" aria-label="Очистить" onClick={() => onChange('')}>
          <XIcon className="size-4" />
        </Button>
      )}
    </div>
  )
}

interface DateTimePickerProps extends Omit<DatePickerProps, 'value' | 'onChange'> {
  /** yyyy-MM-ddTHH:mm (локальное время) или пустая строка */
  value: string
  onChange: (value: string) => void
  /** Время по умолчанию при выборе даты */
  defaultTime?: string
}

/** Дата + время: значение в формате datetime-local (yyyy-MM-ddTHH:mm) */
export function DateTimePicker({
  value,
  onChange,
  defaultTime = '09:00',
  id,
  clearable,
  ...rest
}: DateTimePickerProps) {
  const date = value.slice(0, 10)
  const time = value.slice(11, 16)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <DatePicker
        {...rest}
        id={id}
        className="flex-1"
        value={date}
        onChange={(d) => onChange(d ? `${d}T${time || defaultTime}` : '')}
      />
      <Input
        type="time"
        aria-label="Время"
        className="w-28 shrink-0"
        value={time}
        disabled={!date}
        onChange={(e) => onChange(date && e.target.value ? `${date}T${e.target.value}` : value)}
      />
      {clearable && value && (
        <Button type="button" variant="ghost" size="icon" aria-label="Очистить" onClick={() => onChange('')}>
          <XIcon className="size-4" />
        </Button>
      )}
    </div>
  )
}
