import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Markdown from 'react-markdown'
import { Sparkles } from 'lucide-react'
import { useAppConfig } from '@/entities/session'
import { transactionApi } from '@/entities/transaction'
import { monthTitle } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

/** ИИ-анализ покупок за месяц; скрыт, если провайдер не настроен на сервере */
export function AiAnalysisButton({
  month,
  groupId,
  disabled,
}: {
  month: string
  groupId: string | null
  disabled?: boolean
}) {
  const { data: config } = useAppConfig()
  const [open, setOpen] = useState(false)
  const analysis = useMutation({ mutationFn: () => transactionApi.analysis(month, groupId) })

  if (!config?.features.aiAnalysis) return null

  const run = () => {
    analysis.mutate()
    setOpen(true)
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={run}
        disabled={disabled}
        title={disabled ? 'Сначала добавьте расходы' : undefined}
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">ИИ-анализ покупок</span>
        <span className="sm:hidden">ИИ-анализ</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4.5 text-primary" />
              ИИ-анализ покупок · {monthTitle(month)}
            </DialogTitle>
            <DialogDescription>Разбор подготовлен нейросетью и может содержать неточности</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {analysis.isPending ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Spinner className="size-8 text-primary" />
                <p className="text-sm">Анализируем покупки, это займёт до минуты…</p>
              </div>
            ) : analysis.data ? (
              <Markdown
                components={{
                  h1: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
                  h2: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
                  h3: ({ children }) => <h4 className="mt-4 mb-2 text-sm font-semibold">{children}</h4>,
                  p: ({ children }) => (
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
                  ),
                  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-sm">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  // Ссылки и изображения из ответа модели не рендерим
                  a: ({ children }) => <span>{children}</span>,
                  img: () => null,
                }}
              >
                {analysis.data.analysis}
              </Markdown>
            ) : (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {analysis.error?.message ?? 'Не удалось получить анализ. Попробуйте ещё раз.'}
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => analysis.mutate()}>
                  Повторить
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
