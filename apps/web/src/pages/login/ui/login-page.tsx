import { motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, ListTodo, Users, Wallet } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router'
import { useAppConfig, useViewer } from '@/entities/session'
import { DemoLoginForm, YandexLoginButton } from '@/features/auth'
import { routes } from '@/shared/config'
import { Card, CardContent } from '@/shared/ui/card'

const FEATURES = [
  {
    icon: ListTodo,
    title: 'Задачи и напоминания',
    text: 'Сроки, приоритеты и гибкие напоминания: каждое утро, по дням недели или в точное время',
  },
  {
    icon: Wallet,
    title: 'Семейный бюджет',
    text: 'Доходы и расходы по категориям, графики и разбор трат за месяц',
  },
  {
    icon: CalendarDays,
    title: 'Календарь',
    text: 'Общие события семьи: дни рождения, приёмы врачей, поездки',
  },
  {
    icon: Users,
    title: 'Семейные группы',
    text: 'Общие задачи, бюджет и календарь для всей семьи по коду приглашения',
  },
]

const ERRORS: Record<string, string> = {
  yandex_denied: 'Вход через Яндекс отменён',
  yandex_state: 'Сессия входа устарела — попробуйте ещё раз',
  yandex_failed: 'Не удалось получить данные от Яндекса — попробуйте позже',
  yandex_disabled: 'Вход через Яндекс не настроен на сервере',
}

export function LoginPage() {
  const { data: viewer } = useViewer()
  const { data: config } = useAppConfig()
  const [params] = useSearchParams()
  const error = params.get('error')

  if (viewer) return <Navigate to={routes.dashboard} replace />

  const yandexEnabled = config?.auth.yandex ?? false
  const demoEnabled = config?.auth.demo ?? false

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-50 via-background to-teal-50 dark:from-emerald-950/40 dark:via-background dark:to-teal-950/30">
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="order-2 lg:order-1"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-emerald-600/20">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">LifeBalance</h1>
              <p className="text-sm text-muted-foreground">Баланс задач, бюджета и семьи</p>
            </div>
          </div>
          <h2 className="mb-4 text-3xl leading-tight font-bold sm:text-4xl">
            Одна площадка для задач, бюджета и семейных планов
          </h2>
          <p className="mb-8 max-w-lg text-muted-foreground">
            Планируйте день вместе с семьёй и держите расходы под контролем — с умными напоминаниями.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card key={f.title} className="h-full rounded-xl border shadow-sm">
                <CardContent className="gap-3 p-4">
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <div className="mt-2 text-sm font-medium">{f.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <Card className="rounded-2xl border shadow-xl shadow-emerald-900/5">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div>
                <h3 className="mb-1 text-xl font-semibold">Вход в приложение</h3>
                <p className="text-sm text-muted-foreground">Используйте свой Яндекс ID</p>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {ERRORS[error] ?? 'Не удалось войти'}
                </div>
              )}

              <div className="space-y-2">
                <YandexLoginButton disabled={!yandexEnabled} />
                {config && !yandexEnabled && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Вход через Яндекс не настроен: задайте YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET в
                    apps/api/.env
                  </p>
                )}
              </div>

              {demoEnabled && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs tracking-wider text-muted-foreground uppercase">или</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <DemoLoginForm />
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
