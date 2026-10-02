import { CheckCircle2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useViewer } from '@/entities/session'
import { routes } from '@/shared/config'
import { Button } from '@/shared/ui/button'

export function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="grid size-14 animate-pulse place-items-center rounded-2xl bg-primary text-primary-foreground">
        <CheckCircle2 className="size-8" />
      </div>
      <div className="text-lg font-semibold">LifeBalance</div>
    </div>
  )
}

export function RequireAuth() {
  const { data: viewer, isPending, isError, refetch } = useViewer()
  const location = useLocation()

  if (isPending) return <SplashScreen />
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">Сервер недоступен</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Повторить
        </Button>
      </div>
    )
  }
  if (!viewer) return <Navigate to={routes.login} replace state={{ from: location.pathname }} />
  return <Outlet />
}
