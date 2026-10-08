import { CalendarDays, CheckCircle2, LayoutDashboard, ListTodo, LogOut, Users, Wallet } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useViewer } from '@/entities/session'
import { useLogout } from '@/features/auth'
import { useNewNotificationsToaster } from '@/features/notifications'
import { GroupSwitcher } from '@/features/switch-group'
import { useSyncTimezone } from '@/features/sync-timezone'
import { ThemeToggle } from '@/features/toggle-theme'
import { cn } from '@/shared/lib/cn'
import { routes } from '@/shared/config'
import { initials } from '@/shared/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { NotificationsBell } from './notifications-bell'

const NAV_ITEMS = [
  { to: routes.dashboard, label: 'Дашборд', icon: LayoutDashboard },
  { to: routes.tasks, label: 'Задачи', icon: ListTodo },
  { to: routes.budget, label: 'Бюджет', icon: Wallet },
  { to: routes.calendar, label: 'Календарь', icon: CalendarDays },
  { to: routes.family, label: 'Семья', icon: Users },
]

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('grid place-items-center rounded-xl bg-primary text-primary-foreground', className)}>
      <CheckCircle2 className="size-5" />
    </div>
  )
}

function UserMenu() {
  const { data: user } = useViewer()
  const logout = useLogout()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Меню пользователя"
        >
          <Avatar className="size-9 border">
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate font-semibold">{user?.name ?? 'Пользователь'}</div>
          {user?.email && (
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut className="size-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Каркас приложения: навигация, шапка и фоновая синхронизация */
export function AppLayout() {
  useNewNotificationsToaster()
  useSyncTimezone()

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <Logo className="size-9" />
          <div>
            <div className="leading-tight font-bold">LifeBalance</div>
            <div className="text-[11px] text-muted-foreground">баланс жизни</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === routes.dashboard}
              className={({ isActive }) =>
                cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <item.icon className="size-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:px-5">
            <Logo className="mr-1 size-8 lg:hidden" />
            <GroupSwitcher />
            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              <ThemeToggle />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 pb-24 sm:px-5 sm:py-6 lg:pb-8">
          <Outlet />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          aria-label="Мобильная навигация"
        >
          <div className="grid h-16 grid-cols-5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === routes.dashboard}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <item.icon className="size-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
