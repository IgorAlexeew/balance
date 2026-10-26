import { CalendarDays, LayoutDashboard, ListTodo, LogOut, Users, Wallet } from 'lucide-react'
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
import { BrandMark } from '@/shared/ui/brand-mark'
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
          <Avatar className="size-10 border border-glass-border">
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-sky/25 text-sm font-semibold text-sky-ink">
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
    <div className="flex min-h-screen gap-6 lg:p-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-glass p-5 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-2 pt-1 pb-6">
          <BrandMark />
          <div>
            <div className="text-xl leading-tight font-medium">Баланс</div>
            <div className="text-xs text-muted-foreground">дела и семья</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === routes.dashboard}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-[0.875rem] px-3.5 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-sidebar-accent',
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
        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 lg:static lg:px-0 lg:pt-0">
          <div className="glass mx-auto flex h-16 w-full max-w-6xl items-center gap-2 rounded-glass px-3 sm:px-4 lg:h-auto lg:border-0 lg:bg-transparent lg:px-1 lg:py-1 lg:shadow-none lg:backdrop-blur-none">
            <BrandMark className="mr-1 size-9 lg:hidden" />
            <GroupSwitcher />
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 pb-32 sm:px-5 sm:py-6 lg:px-0 lg:pb-8">
          <Outlet />
        </main>

        <nav
          className="glass fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 rounded-glass lg:hidden"
          aria-label="Мобильная навигация"
        >
          <div className="grid h-[4.5rem] grid-cols-5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === routes.dashboard}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="size-5.5" strokeWidth={isActive ? 2.4 : 2} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
