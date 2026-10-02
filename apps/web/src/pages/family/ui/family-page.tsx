import { ArrowRight, Check, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { FamilyGroupDTO } from '@balance/contracts'
import { InviteCode, MemberRow, useActiveGroup } from '@/entities/family-group'
import { useViewer } from '@/entities/session'
import { CreateGroupCard } from '@/features/family-create'
import { JoinGroupCard } from '@/features/family-join'
import { GroupActions, RegenerateInviteCodeButton } from '@/features/family-membership'
import { fmtDate, plural } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { EmptyState } from '@/shared/ui/empty-state'
import { Separator } from '@/shared/ui/separator'
import { Skeleton } from '@/shared/ui/skeleton'

function GroupCard({
  group,
  isActive,
  viewerId,
  onActivate,
}: {
  group: FamilyGroupDTO
  isActive: boolean
  viewerId: string | null
  onActivate: () => void
}) {
  const isOwner = group.ownerId === viewerId
  const count = group.members.length
  const members = [...group.members].sort((a, b) =>
    a.role !== b.role ? (a.role === 'owner' ? -1 : 1) : (a.name ?? '').localeCompare(b.name ?? '', 'ru'),
  )

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold">{group.name}</span>
              {isActive && <Badge>Активна</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge variant="secondary">
                {count} {plural(count, 'участник', 'участника', 'участников')}
              </Badge>
              <span className="text-xs text-muted-foreground">создана {fmtDate(group.createdAt)}</span>
            </div>
            {group.description && <p className="mt-1.5 text-sm text-muted-foreground">{group.description}</p>}
          </div>
        </div>

        <InviteCode
          code={group.inviteCode}
          action={isOwner ? <RegenerateInviteCodeButton groupId={group.id} /> : null}
        />

        <div>
          <Separator />
          <div className="mt-2 text-xs font-medium text-muted-foreground">Участники</div>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} isMe={m.userId === viewerId} />
          ))}
        </div>

        <div>
          <Separator />
          <div className="mt-3 flex flex-wrap gap-2">
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
            <GroupActions group={group} isOwner={isOwner} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FamilyPage() {
  const { data: viewer } = useViewer()
  const { groupId, groups, setActiveGroupId, isLoading } = useActiveGroup()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Семейные группы</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Общие задачи, бюджет и календарь для всей семьи
        </p>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <CreateGroupCard />
        <JoinGroupCard />
      </div>

      {isLoading ? (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="rounded-xl border py-0 shadow-sm">
          <EmptyState
            icon={Users}
            title="У вас пока нет семейных групп"
            description="Создайте группу и поделитесь кодом приглашения с близкими — они увидят общие задачи, бюджет и календарь."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              isActive={group.id === groupId}
              viewerId={viewer?.id ?? null}
              onActivate={() => {
                setActiveGroupId(group.id)
                toast.success(`Переключено на «${group.name}»`)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
