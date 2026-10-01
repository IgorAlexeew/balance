'use client'

import { useSession, signOut } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Moon,
  Plus,
  Sun,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { initials } from '@/lib/format'
import { useAppStore, type ViewName } from '@/lib/store'
import { RemindersWatcher } from '@/components/reminders-watcher'
import { NotificationsBell } from '@/components/notifications-bell'
import { DashboardView } from '@/components/views/dashboard'
import { TasksView } from '@/components/views/tasks'
import { BudgetView } from '@/components/views/budget'
import { CalendarView } from '@/components/views/calendar'
import { FamilyView } from '@/components/views/family'

const NAV_ITEMS: { key: ViewName; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { key: 'tasks', label: 'Задачи', icon: ListTodo },
  { key: 'budget', label: 'Бюджет', icon: Wallet },
  { key: 'calendar', label: 'Календарь', icon: CalendarDays },
  { key: 'family', label: 'Семья', icon: Users },
]

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label="Переключить тему"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-5 hidden dark:block" />
      <Moon className="size-5 dark:hidden" />
    </Button>
  )
}

function GroupSwitcher() {
  const groupId = useAppStore((s) => s.groupId)
  const setGroupId = useAppStore((s) => s.setGroupId)
  const setView = useAppStore((s) => s.setView)
  const { data: groups = [] } = useQuery({ queryKey: ['family'], queryFn: api.family.list })
  const activeGroup = groups.find((g) => g.id === groupId) ?? null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 max-w-52 font-medium">
          {activeGroup ? <Users className="size-4 text-primary" /> : <User className="size-4 text-primary" />}
          <span className="truncate">{activeGroup ? activeGroup.name : 'Личные данные'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem
          onClick={() => setGroupId(null)}
          className={cn(!groupId && 'bg-accent')}
        >
          <User className="size-4" />
          Личные данные
        </DropdownMenuItem>
        {groups.map((g) => (
          <DropdownMenuItem key={g.id} onClick={() => setGroupId(g.id)} className={cn(groupId === g.id && 'bg-accent')}>
            <Users className="size-4" />
            <span className="truncate">{g.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{g.members.length}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setGroupId(null)
            setView('family')
          }}
        >
          <Plus className="size-4" />
          Создать или вступить в группу
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Меню пользователя"
        >
          <Avatar className="size-9 border">
            {user?.image ? <AvatarImage src={user.image} alt={user.name ?? 'Аватар'} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-semibold truncate">{user?.name ?? 'Пользователь'}</div>
          <div className="text-xs text-muted-foreground font-normal truncate">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut({ callbackUrl: '/' })}>
          <LogOut className="size-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex min-h-0">
        {/* Сайдбар (десктоп) */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2.5 px-5 h-16 border-b">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <div className="font-bold leading-tight">LifeBalance</div>
              <div className="text-[11px] text-muted-foreground">баланс жизни</div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Основная навигация">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  view === item.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={view === item.key ? 'page' : undefined}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="px-5 py-4 text-[11px] text-muted-foreground border-t">
            LifeBalance · вход через Яндекс ID
          </div>
        </aside>

        {/* Контент */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="h-14 px-3 sm:px-5 flex items-center gap-2 max-w-6xl w-full mx-auto">
              {/* Логотип на мобильных */}
              <div className="lg:hidden flex items-center gap-2 mr-1">
                <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                  <CheckCircle2 className="size-4.5" />
                </div>
              </div>
              <GroupSwitcher />
              <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
                <ThemeToggle />
                <NotificationsBell />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="flex-1 px-3 sm:px-5 py-5 sm:py-6 pb-24 lg:pb-8 max-w-6xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {view === 'dashboard' && <DashboardView />}
                {view === 'tasks' && <TasksView />}
                {view === 'budget' && <BudgetView />}
                {view === 'calendar' && <CalendarView />}
                {view === 'family' && <FamilyView />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Нижняя навигация (мобильные) */}
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
            aria-label="Мобильная навигация"
          >
            <div className="grid grid-cols-5 h-16">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    view === item.key ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-current={view === item.key ? 'page' : undefined}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>

      <RemindersWatcher />

      <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground pb-16 lg:pb-4 bg-background">
        LifeBalance © {new Date().getFullYear()} — задачи, бюджет, календарь и семья в одном месте
      </footer>
    </div>
  )
}
