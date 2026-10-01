'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarDays, Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound, ListTodo, Loader2, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

/** Приложение открыто внутри кросс-доменного iframe (панель предпросмотра)? */
function isInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/** Логотип Яндекс ID (инлайн-SVG) */
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

const FEATURES = [
  {
    icon: ListTodo,
    title: 'Задачи и напоминания',
    text: 'Сроки, приоритеты и гибкие напоминания: каждое утро, по дням недели или в точное время',
  },
  {
    icon: Wallet,
    title: 'Семейный бюджет',
    text: 'Доходы и расходы по категориям с ИИ-анализом покупок за месяц',
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

/** Блок с данными для регистрации приложения в Яндекс OAuth и вставки ключей */
function OauthSetupHint({
  yandexEnabled,
  onKeysSaved,
}: {
  yandexEnabled: boolean
  onKeysSaved: () => void
}) {
  const [origin, setOrigin] = useState<string | null>(null)
  const [oauthHost, setOauthHost] = useState<string | null>(null)
  const [copied, setCopied] = useState<'host' | 'uri' | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [waitingRestart, setWaitingRestart] = useState(false)
  const stopPollRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    stopPollRef.current = false
    // setState — только из асинхронных колбэков, не синхронно в эффекте
    fetch('/api/oauth-setup')
      .then((r) => r.json() as Promise<{ host?: string | null }>)
      .then((d) => {
        if (cancelled) return
        setOrigin(window.location.origin)
        setOauthHost(d.host ?? null)
      })
      .catch(() => {
        if (!cancelled) setOrigin(window.location.origin)
      })
    return () => {
      cancelled = true
      stopPollRef.current = true
    }
  }, [])

  const saveKeys = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/oauth-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Не удалось сохранить ключи')
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: async () => {
      toast.success('Ключи сохранены в .env.local — сервер перезапускается…')
      setClientId('')
      setClientSecret('')
      setWaitingRestart(true)
      // Ждём перезапуск dev-сервера и появления yandex-провайдера
      for (let i = 0; i < 30 && !stopPollRef.current; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const res = await fetch('/api/auth/providers', { cache: 'no-store' })
          if (res.ok && Object.keys((await res.json()) as Record<string, unknown>).includes('yandex')) {
            onKeysSaved()
            setWaitingRestart(false)
            toast.success('Готово — вход через Яндекс ID активирован')
            return
          }
        } catch {
          // сервер перезапускается — через пару секунд попробуем снова
        }
      }
      if (!stopPollRef.current) {
        setWaitingRestart(false)
        toast.info('Сервер перезапускается дольше обычного — обновите страницу через минуту')
      }
    },
  })

  if (!origin) return null

  const redirectUri = `${origin}/api/auth/callback/yandex`
  const mismatch = oauthHost !== null && oauthHost !== origin

  const keyForm = (
    <div className="space-y-2">
      <Input
        placeholder="ClientID (32 символа)"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="relative">
        <Input
          type={showSecret ? 'text' : 'password'}
          placeholder="ClientSecret"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowSecret((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showSecret ? 'Скрыть секрет' : 'Показать секрет'}
        >
          {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <Button
        size="sm"
        className="w-full h-9"
        onClick={() => saveKeys.mutate()}
        disabled={saveKeys.isPending || waitingRestart || !clientId.trim() || !clientSecret.trim()}
      >
        {saveKeys.isPending || waitingRestart ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {waitingRestart && !saveKeys.isPending ? 'Ждём перезапуск сервера…' : 'Сохраняем…'}
          </>
        ) : (
          'Сохранить ключи в .env.local'
        )}
      </Button>
    </div>
  )

  const copy = async (value: string, which: 'host' | 'uri') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      toast.success('Скопировано в буфер обмена')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Не удалось скопировать — выделите текст вручную')
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="size-4 text-primary" />
        Данные для формы Яндекс OAuth
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Это хост, на котором сейчас развёрнуто приложение. Скопируйте его в поле{' '}
        <span className="font-medium text-foreground">«Хост страницы, на которой разместится кнопка или виджет авторизации»</span>{' '}
        формы регистрации (https://oauth.yandex.ru/client/new).
      </p>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Хост страницы:</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded border bg-background px-2 py-1.5 text-xs">
            {origin}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Скопировать хост"
            onClick={() => void copy(origin, 'host')}
          >
            {copied === 'host' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          Redirect URI (добавьте его в список «Redirect URI» платформы «Веб-сервисы»):
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded border bg-background px-2 py-1.5 text-xs">
            {redirectUri}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Скопировать Redirect URI"
            onClick={() => void copy(redirectUri, 'uri')}
          >
            {copied === 'uri' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
      {mismatch && (
        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
          Внимание: сервер формирует OAuth-ссылки для другого хоста ({oauthHost}). Сообщите об этом
          ассистенту — нужно поправить переменную NEXTAUTH_URL.
        </p>
      )}
      <div className="h-px bg-border" />
      {yandexEnabled ? (
        <div className="space-y-2">
          <p className="text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Ключи настроены — вход через Яндекс ID активен
          </p>
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
              Изменить ключи
            </summary>
            <div className="pt-2">{keyForm}</div>
          </details>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Вставьте ClientID и ClientSecret со страницы вашего приложения в{' '}
            <a
              href="https://oauth.yandex.ru/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              Яндекс OAuth
            </a>
            . Они уйдут из вашего браузера напрямую в файл{' '}
            <code className="bg-background border rounded px-1 py-0.5 text-[11px]">.env.local</code>{' '}
            на сервере — минуя чат.
          </p>
          {keyForm}
        </div>
      )}
    </div>
  )
}

export function AuthScreen() {
  const [providers, setProviders] = useState<Record<string, { id: string }>>({})
  const [name, setName] = useState('')
  const [providersTick, setProvidersTick] = useState(0)
  const [cookieBlockedHint, setCookieBlockedHint] = useState(false)
  const autoSigninRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((p) => {
        if (!cancelled) setProviders(p)
      })
      .catch(() => {
        if (!cancelled) setProviders({})
      })
    return () => {
      cancelled = true
    }
  }, [providersTick])

  const yandexEnabled = 'yandex' in providers

  // Окно авторизации (открыто из панели предпросмотра): сразу запускаем вход в Яндекс.
  // Маркер from=auth-popup нужен окну, чтобы после успешного входа закрыться и
  // сообщить панели об успехе
  useEffect(() => {
    if (autoSigninRef.current) return
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('auth') !== 'yandex') return
    if (!yandexEnabled) return
    autoSigninRef.current = true
    void signIn('yandex', { callbackUrl: '/?from=auth-popup' })
  }, [yandexEnabled])

  // Всплывающее окно сообщило об успешном входе — перезагружаем страницу с новой сессией
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if ((e.data as { type?: string } | null)?.type === 'lifebalance:auth-success') {
        window.location.replace('/?authed=1')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // После перезагрузки сессии нет — браузер блокирует куки во встроенной панели
  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled && new URLSearchParams(window.location.search).get('authed') === '1') {
        setCookieBlockedHint(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const demoLogin = useMutation({
    mutationFn: async () => {
      // ВАЖНО: undefined в credentials сериализуется в строку "undefined",
      // поэтому передаём name только если он непустой
      const trimmed = name.trim()
      // Если вход выполняется в окне авторизации — после успеха окно закроется само
      const callbackUrl = window.opener ? '/?from=auth-popup' : '/'
      await signIn(
        'demo',
        trimmed ? { name: trimmed, redirect: false, callbackUrl } : { callbackUrl },
      )
    },
    onError: () =>
      toast.error(
        isInIframe()
          ? 'Не удалось войти: возможно, браузер блокирует cookie во встроенной панели. Откройте приложение в отдельной вкладке (кнопка «Открыть в новой вкладке» над панелью предпросмотра).'
          : 'Не удалось войти. Попробуйте ещё раз.',
      ),
  })

  const yandexLogin = useMutation({
    mutationFn: async () => {
      await signIn('yandex', { callbackUrl: '/' })
    },
  })

  const handleYandexClick = () => {
    if (isInIframe()) {
      // Панель предпросмотра — кросс-доменный iframe: Яндекс запрещает встраивание
      // своих страниц (X-Frame-Options: DENY), поэтому вход открываем в отдельном окне,
      // где куки работают как обычно. После успеха окно закроется само.
      const popup = window.open(
        '/?auth=yandex',
        'lifebalance-yandex-auth',
        'popup=yes,width=560,height=700',
      )
      if (!popup) {
        toast.error(
          'Браузер заблокировал всплывающее окно. Разрешите pop-up для этого сайта или откройте приложение в отдельной вкладке (кнопка «Открыть в новой вкладке» над панелью предпросмотра).',
          { duration: 8000 },
        )
      }
      return
    }
    yandexLogin.mutate()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-background to-teal-50 dark:from-emerald-950/40 dark:via-background dark:to-teal-950/30">
      <main className="flex-1 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 lg:py-16">
        {/* Левая колонка — промо */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="order-2 lg:order-1"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="size-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-emerald-600/20">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">LifeBalance</h1>
              <p className="text-sm text-muted-foreground">Баланс задач, бюджета и семьи</p>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
            Одна площадка для задач,
            <br />
            бюджета и семейных планов
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg">
            Входите через Яндекс ID, планируйте день вместе с семьёй и держите расходы под
            контролем — с умными напоминаниями и ИИ-анализом покупок.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
              >
                <Card className="h-full rounded-xl border shadow-sm">
                  <CardContent className="p-4 gap-3">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <f.icon className="size-5" />
                    </div>
                    <div className="mt-2 font-medium text-sm">{f.title}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{f.text}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Правая колонка — вход */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <Card className="rounded-2xl shadow-xl shadow-emerald-900/5 border">
            <CardContent className="p-6 sm:p-8">
              <h3 className="text-xl font-semibold mb-1">Вход в приложение</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Используйте Яндекс ID или демо-режим для знакомства с приложением
              </p>

              {cookieBlockedHint && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Похоже, браузер блокирует cookie во встроенной панели. Нажмите «Открыть в новой
                  вкладке» над панелью предпросмотра — в отдельной вкладке вход работает полноценно.
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold bg-[#FC3F1D] hover:bg-[#e63517] text-white shadow-md"
                onClick={() => handleYandexClick()}
                disabled={!yandexEnabled || yandexLogin.isPending}
                title={yandexEnabled ? 'Войти через Яндекс ID' : 'Вставьте ключи Яндекс OAuth в блоке ниже'}
              >
                {yandexLogin.isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <YandexLogo className="size-5" />
                )}
                Войти через Яндекс ID
              </Button>

              {!yandexEnabled && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Вставьте ClientID и ClientSecret от приложения Яндекса в блоке ниже — они
                  сохранятся напрямую в файл{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.env.local</code>,
                  минуя чат. Либо заполните файл вручную.
                </p>
              )}
              <OauthSetupHint
                yandexEnabled={yandexEnabled}
                onKeysSaved={() => setProvidersTick((t) => t + 1)}
              />

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">или</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="demo-name">Демо-вход</Label>
                  <Input
                    id="demo-name"
                    placeholder="Ваше имя (необязательно)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !demoLogin.isPending) demoLogin.mutate()
                    }}
                    maxLength={40}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full h-11 font-medium"
                  onClick={() => demoLogin.mutate()}
                  disabled={demoLogin.isPending}
                >
                  {demoLogin.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Входим…
                    </>
                  ) : (
                    'Открыть демо с готовыми данными'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Без имени откроется демо-аккаунт с заполненными задачами, бюджетом и семейной
                  группой. С именем — свежий аккаунт (удобно, чтобы протестировать вход в группу).
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground border-t">
        LifeBalance © {new Date().getFullYear()} — баланс задач, бюджета и семьи
      </footer>
    </div>
  )
}
