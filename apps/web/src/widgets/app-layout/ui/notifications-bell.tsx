import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/entities/notification'
import { EnableBrowserNotifications, useMarkNotificationsRead } from '@/features/notifications'
import { cn } from '@/shared/lib/cn'
import { fmtDateTime, relativeDay } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Skeleton } from '@/shared/ui/skeleton'

export function NotificationsBell() {
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Уведомления">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="text-sm font-semibold">Уведомления</div>
          <div className="flex items-center gap-1">
            <EnableBrowserNotifications />
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => markRead.mutate({ all: true })}
              >
                <CheckCheck className="size-3.5" />
                Прочитать все
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Пока нет уведомлений</div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read && markRead.mutate({ ids: [n.id] })}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      n.read ? 'bg-muted-foreground/30' : 'animate-pulse bg-primary',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-medium">{n.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">
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
