import type { ReactNode } from 'react'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'

export function InviteCode({ code, action }: { code: string; action?: ReactNode }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Код скопирован')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Не удалось скопировать — выделите код вручную')
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Код приглашения</Label>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="font-mono text-lg font-semibold tracking-[0.25em] select-all">{code}</span>
        <div className="ml-auto flex shrink-0 items-center">
          {action}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void copy()}
            aria-label="Скопировать код приглашения"
          >
            {copied ? (
              <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
