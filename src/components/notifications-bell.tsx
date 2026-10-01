'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { fmtDateTime, relativeDay } from '@/lib/format'
import { cn } from '@/lib/utils'

export function NotificationsBell() {
  const queryClient = useQueryClient()
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(false),
    refetchInterval: 60_000,
  })

  const unread = notifications.filter((n) => !n.read)
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const markAllRead = async () => {
    await api.notifications.markRead({ all: true })
    await queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markOneRead = async (id: string) => {
    await api.notifications.markRead({ ids: [id] })
    await queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Уведомления">
          <Bell className="size-5" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold grid place-items-center">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 rounded-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Уведомления</div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={markAllRead}>
              <CheckCheck className="size-3.5" />
              Прочитать все
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Пока нет уведомлений
            </div>
          ) : (
            <div className="divide-y">
              {sorted.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markOneRead(n.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/50 transition-colors',
                    !n.read && 'bg-primary/5'
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      n.read ? 'bg-muted-foreground/30' : 'bg-primary animate-pulse'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    <span className="block text-xs text-muted-foreground leading-snug mt-0.5">
                      {n.body}
                    </span>
                    <span className="block text-[11px] text-muted-foreground/70 mt-1">
                      {relativeDay(n.createdAt)} · {fmtDateTime(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
