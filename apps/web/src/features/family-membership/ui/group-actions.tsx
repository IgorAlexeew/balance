import { useState } from 'react'
import { LogOut, RefreshCw, Trash2 } from 'lucide-react'
import type { FamilyGroupDTO } from '@balance/contracts'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { useMembershipActions } from '../model/use-membership-actions'

export function GroupActions({ group, isOwner }: { group: FamilyGroupDTO; isOwner: boolean }) {
  const { leave, remove } = useMembershipActions()
  const [confirm, setConfirm] = useState<'leave' | 'remove' | null>(null)
  const busy = leave.isPending || remove.isPending

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-destructive hover:text-destructive"
        onClick={() => setConfirm('leave')}
        disabled={busy}
      >
        <LogOut className="size-3.5" />
        Выйти
      </Button>
      {isOwner && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => setConfirm('remove')}
          disabled={busy}
        >
          <Trash2 className="size-3.5" />
          Удалить
        </Button>
      )}

      <ConfirmDialog
        open={confirm === 'leave'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Выйти из группы?"
        description={
          isOwner
            ? 'Вы владелец. Владение перейдёт самому давнему участнику, а если вы один — группа будет удалена.'
            : 'Вы потеряете доступ к общим задачам, бюджету и календарю группы.'
        }
        confirmLabel="Выйти"
        onConfirm={() => leave.mutate(group.id)}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Удалить группу?"
        description="Будут удалены все общие задачи, записи бюджета и события группы. Действие необратимо."
        onConfirm={() => remove.mutate(group.id)}
      />
    </>
  )
}

export function RegenerateInviteCodeButton({ groupId }: { groupId: string }) {
  const { regenerateCode } = useMembershipActions()
  return (
    <ConfirmDialog
      title="Обновить код приглашения?"
      description="Старый код перестанет работать. Участники группы останутся в ней."
      confirmLabel="Обновить"
      destructive={false}
      onConfirm={() => regenerateCode.mutate(groupId)}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Обновить код приглашения"
          disabled={regenerateCode.isPending}
        >
          <RefreshCw className={regenerateCode.isPending ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      }
    />
  )
}
