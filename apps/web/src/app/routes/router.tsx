import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/widgets/app-layout'
import { routes } from '@/shared/config'
import { RequireAuth, SplashScreen } from './require-auth'

/** Страницы грузятся лениво: графики бюджета и календарь не попадают в стартовый бандл */
const lazyPage = (load: () => Promise<{ Component: React.ComponentType }>) => async () => load()

export const router = createBrowserRouter([
  {
    path: routes.login,
    lazy: lazyPage(() => import('@/pages/login').then((m) => ({ Component: m.LoginPage }))),
    HydrateFallback: SplashScreen,
  },
  {
    element: <RequireAuth />,
    HydrateFallback: SplashScreen,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            lazy: lazyPage(() => import('@/pages/dashboard').then((m) => ({ Component: m.DashboardPage }))),
          },
          {
            path: routes.tasks,
            lazy: lazyPage(() => import('@/pages/tasks').then((m) => ({ Component: m.TasksPage }))),
          },
          {
            path: routes.budget,
            lazy: lazyPage(() => import('@/pages/budget').then((m) => ({ Component: m.BudgetPage }))),
          },
          {
            path: routes.calendar,
            lazy: lazyPage(() => import('@/pages/calendar').then((m) => ({ Component: m.CalendarPage }))),
          },
          {
            path: routes.family,
            lazy: lazyPage(() => import('@/pages/family').then((m) => ({ Component: m.FamilyPage }))),
          },
          {
            path: '*',
            lazy: lazyPage(() => import('@/pages/not-found').then((m) => ({ Component: m.NotFoundPage }))),
          },
        ],
      },
    ],
  },
])
