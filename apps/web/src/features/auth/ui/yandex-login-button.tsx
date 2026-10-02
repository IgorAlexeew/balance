import { Button } from '@/shared/ui/button'
import { startYandexLogin } from '../model/use-auth-actions'

function YandexLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M17.7 2h-3.08c-2.9 0-4.85 2.03-4.85 5.1v2.44H6.9a.4.4 0 0 0-.4.4v2.57a.4.4 0 0 0 .4.4h2.87v8.69c0 .22.18.4.4.4h2.86a.4.4 0 0 0 .4-.4v-8.69h2.62a.4.4 0 0 0 .4-.4l.01-2.57a.4.4 0 0 0-.4-.4h-2.63V7.35c0-.88.2-1.33 1.28-1.33h1.6a.4.4 0 0 0 .4-.4V2.4a.4.4 0 0 0-.4-.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function YandexLoginButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button
      size="lg"
      className="h-12 w-full bg-[#FC3F1D] text-base font-semibold text-white shadow-md hover:bg-[#e63517]"
      onClick={startYandexLogin}
      disabled={disabled}
    >
      <YandexLogo className="size-5" />
      Войти через Яндекс ID
    </Button>
  )
}
