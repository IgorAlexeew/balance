import { Link } from 'react-router'
import { routes } from '@/shared/config'
import { Button } from '@/shared/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="text-5xl font-bold text-muted-foreground/40">404</div>
      <p className="text-muted-foreground">Такой страницы нет</p>
      <Button asChild variant="outline">
        <Link to={routes.dashboard}>На главную</Link>
      </Button>
    </div>
  )
}
