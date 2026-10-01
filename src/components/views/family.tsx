'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { fmtDate, initials, plural } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import type { FamilyGroupDTO, FamilyMemberDTO } from '@/lib/types'

/** Блок с кодом приглашения и кнопкой копирования */
function InviteCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!navigator.clipboard) {
      toast.error('Копирование недоступно в этом браузере')
      return
    }
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true)
        toast.success('Код скопирован')
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Не удалось скопировать код'))
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Код приглашения</Label>
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/50">
        <span className="font-mono font-semibold tracking-[0.3em] text-lg select-all">{code}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-8 shrink-0"
          onClick={handleCopy}
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
  )
}

/** Строка участника группы */
function MemberRow({ member, isMe }: { member: FamilyMemberDTO; isMe: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Avatar className="size-7">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {initials(member.name ?? member.email)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium truncate">
        {member.name ?? member.email ?? 'Участник'}
        {isMe && <span className="text-muted-foreground font-normal"> (вы)</span>}
      </span>
      {member.role === 'owner' ? (
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Crown className="size-3.5 text-amber-500" />
          Владелец
        </span>
      ) : (
        <span className="ml-auto text-xs text-muted-foreground shrink-0">Участник</span>
      )}
    </div>
  )
}

interface GroupCardProps {
  group: FamilyGroupDTO
  isActive: boolean
  isOwner: boolean
  currentUserId: string | null
  busy: boolean
  onActivate: () => void
  onLeave: () => void
  onRemove: () => void
}

/** Карточка одной группы */
function GroupCard({
  group,
  isActive,
  isOwner,
  currentUserId,
  busy,
  onActivate,
  onLeave,
  onRemove,
}: GroupCardProps) {
  const members = [...group.members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
    return (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? '', 'ru')
  })
  const count = group.members.length

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Шапка */}
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <Users className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold">{group.name}</span>
              {isActive && <Badge>Активна</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <Badge variant="secondary">
                {count} {plural(count, 'участник', 'участника', 'участников')}
              </Badge>
              <span className="text-xs text-muted-foreground">создана {fmtDate(group.createdAt)}</span>
            </div>
            {group.description && (
              <p className="text-sm text-muted-foreground mt-1.5">{group.description}</p>
            )}
          </div>
        </div>

        {/* Код приглашения */}
        <InviteCodeBlock code={group.inviteCode} />

        {/* Участники */}
        <div>
          <Separator />
          <div className="text-xs text-muted-foreground font-medium mt-2">Участники</div>
          <div>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isMe={m.userId === currentUserId} />
            ))}
          </div>
        </div>

        {/* Действия */}
        <div>
          <Separator />
          <div className="flex flex-wrap gap-2 mt-3">
            {isActive ? (
              <Button variant="ghost" size="sm" disabled className="gap-1.5">
                <Check className="size-3.5" />
                Активная группа
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onActivate}>
                <ArrowRight className="size-3.5" />
                Сделать активной
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={onLeave}
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
                onClick={onRemove}
                disabled={busy}
              >
                <Trash2 className="size-3.5" />
                Удалить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FamilyView() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const activeGroupId = useAppStore((s) => s.groupId)
  const setGroupId = useAppStore((s) => s.setGroupId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [leaveTarget, setLeaveTarget] = useState<FamilyGroupDTO | null>(null)
  const [removeTarget, setRemoveTarget] = useState<FamilyGroupDTO | null>(null)

  const currentUserId = session?.user?.id ?? null
  const groupsQ = useQuery({ queryKey: ['family'], queryFn: api.family.list })
  const groups = groupsQ.data ?? []

  /** Сброс контекста группы: возврат к личным данным и обновление всех зависимых выборок */
  const resetGroupContext = () => {
    setGroupId(null)
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    void queryClient.invalidateQueries({ queryKey: ['summary'] })
    void queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  const createQ = useMutation({
    mutationFn: (input: { name: string; description?: string | null }) => api.family.create(input),
    onSuccess: () => {
      setName('')
      setDescription('')
      toast.success('Группа создана! Поделитесь кодом приглашения')
      void queryClient.invalidateQueries({ queryKey: ['family'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const joinQ = useMutation({
    mutationFn: (code: string) => api.family.join(code),
    onSuccess: () => {
      setInviteCode('')
      toast.success('Вы вступили в группу!')
      void queryClient.invalidateQueries({ queryKey: ['family'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const leaveQ = useMutation({
    mutationFn: (groupId: string) => api.family.leave(groupId),
    onSuccess: (_data, groupId) => {
      toast.success('Вы вышли из группы')
      void queryClient.invalidateQueries({ queryKey: ['family'] })
      if (groupId === activeGroupId) resetGroupContext()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeQ = useMutation({
    mutationFn: (groupId: string) => api.family.remove(groupId),
    onSuccess: (_data, groupId) => {
      toast.success('Группа удалена')
      void queryClient.invalidateQueries({ queryKey: ['family'] })
      if (groupId === activeGroupId) resetGroupContext()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Семейные группы</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Общие задачи, бюджет и календарь для всей семьи
        </p>
      </div>

      {/* Действия */}
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        {/* Создать группу */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="size-4.5 text-primary" />
              Создать группу
            </CardTitle>
            <CardDescription>Общее пространство для вашей семьи или близких</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim() || createQ.isPending) return
                createQ.mutate({ name: name.trim(), description: description.trim() || null })
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="family-name">Название</Label>
                <Input
                  id="family-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например, Семья Ивановых"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="family-description">
                  Описание <span className="text-muted-foreground font-normal">(необязательно)</span>
                </Label>
                <Textarea
                  id="family-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Например, совместные планы и покупки"
                  rows={2}
                  maxLength={300}
                />
              </div>
              <Button type="submit" className="gap-1.5" disabled={!name.trim() || createQ.isPending}>
                {createQ.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Создать
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Присоединиться по коду */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
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
                if (inviteCode.length < 6 || joinQ.isPending) return
                joinQ.mutate(inviteCode)
              }}
            >
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                aria-label="Код приглашения"
                className="font-mono text-center text-lg tracking-wide"
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full gap-1.5"
                disabled={inviteCode.length < 6 || joinQ.isPending}
              >
                {joinQ.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Вступить
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Список групп */}
      {groupsQ.isLoading ? (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {[0, 1].map((i) => (
            <Card key={i} className="rounded-xl border shadow-sm">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-28 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groupsQ.isError ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="py-10 text-center">
            <Users className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Не удалось загрузить список групп</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void groupsQ.refetch()}
            >
              Повторить
            </Button>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="py-10 text-center">
            <Users className="size-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-base font-medium">У вас пока нет семейных групп</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
              Создайте группу и поделитесь кодом приглашения с близкими — они увидят общие задачи,
              бюджет и календарь.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {groups.map((group) => {
            const busy =
              (leaveQ.isPending && leaveQ.variables === group.id) ||
              (removeQ.isPending && removeQ.variables === group.id)
            return (
              <GroupCard
                key={group.id}
                group={group}
                isActive={group.id === activeGroupId}
                isOwner={group.ownerId === currentUserId}
                currentUserId={currentUserId}
                busy={busy}
                onActivate={() => {
                  setGroupId(group.id)
                  toast.success(`Переключено на «${group.name}»`)
                }}
                onLeave={() => setLeaveTarget(group)}
                onRemove={() => setRemoveTarget(group)}
              />
            )
          })}
        </div>
      )}

      {/* Диалог подтверждения выхода */}
      <AlertDialog
        open={leaveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выйти из группы?</AlertDialogTitle>
            <AlertDialogDescription>
              {leaveTarget && leaveTarget.ownerId === currentUserId
                ? 'Вы владелец. Владение перейдёт другому участнику, а если вы один — группа будет удалена.'
                : 'Вы потеряете доступ к общим задачам, бюджету и календарю группы.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaveTarget) leaveQ.mutate(leaveTarget.id)
              }}
            >
              Выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог подтверждения удаления */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены все общие задачи, записи бюджета и события группы. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (removeTarget) removeQ.mutate(removeTarget.id)
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
