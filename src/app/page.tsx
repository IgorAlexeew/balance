'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { CheckCircle2 } from 'lucide-react'
import { AuthScreen } from '@/components/auth-screen'
import { AppShell } from '@/components/app-shell'

function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="size-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center animate-pulse">
        <CheckCircle2 className="size-8" />
      </div>
      <div className="text-lg font-semibold">LifeBalance</div>
    </div>
  )
}

export default function Home() {
  const { data: session, status } = useSession()

  // Если страница открыта как окно авторизации из панели предпросмотра —
  // сообщаем родителю об успехе и закрываем окно. Маркер from=auth-popup
  // передаётся в callbackUrl при входе из окна (window.name ненадёжен —
  // браузеры очищают его при кросс-доменной навигации через Яндекс)
  useEffect(() => {
    if (!session?.user?.id) return
    if (!window.opener || window.opener.closed) return
    if (new URLSearchParams(window.location.search).get('from') !== 'auth-popup') return
    try {
      window.opener.postMessage({ type: 'lifebalance:auth-success' }, window.location.origin)
    } catch {
      // окно всё равно закроем ниже
    }
    window.history.replaceState(null, '', '/')
    window.close()
  }, [session?.user?.id])

  if (status === 'loading') return <SplashScreen />
  if (status === 'unauthenticated') return <AuthScreen />
  if (!session?.user?.id) return <SplashScreen />

  return <AppShell />
}
