import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { INVITE_CODE_LENGTH } from '@balance/contracts'
import { familyApi, familyKeys, useActiveGroupStore } from '@/entities/family-group'
import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'

const MIN_CODE_LENGTH = 6

export function JoinGroupCard() {
  const queryClient = useQueryClient()
  const setActiveGroupId = useActiveGroupStore((s) => s.setActiveGroupId)
  const [code, setCode] = useState('')

  const join = useMutation({
    mutationFn: () => familyApi.join(code),
    onSuccess: (group) => {
      setCode('')
      setActiveGroupId(group.id)
      toast.success(`Вы вступили в группу «${group.name}»`)
      void queryClient.invalidateQueries({ queryKey: familyKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4.5 text-primary" />
          Присоединиться по коду
        </CardTitle>
        <CardDescription>Введите код от группы близкого человека</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length >= MIN_CODE_LENGTH && !join.isPending) join.mutate()
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ABCD2345"
            maxLength={INVITE_CODE_LENGTH}
            autoComplete="off"
            spellCheck={false}
            aria-label="Код приглашения"
            className="text-center font-mono text-lg tracking-wide"
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full gap-1.5"
            disabled={code.length < MIN_CODE_LENGTH || join.isPending}
          >
            {join.isPending ? <Spinner /> : <UserPlus className="size-4" />}
            Вступить
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
