import { Navigate, Outlet, useLocation } from 'react-router'
import { useViewer } from '@/entities/session'
import { routes } from '@/shared/config'
import { BrandMark } from '@/shared/ui/brand-mark'
import { Button } from '@/shared/ui/button'

export function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <BrandMark className="size-16 animate-pulse" />
      <div className="text-lg font-medium">Баланс</div>
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
