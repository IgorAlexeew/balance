import { Crown } from 'lucide-react'
import type { FamilyMemberDTO } from '@balance/contracts'
import { initials } from '@/shared/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'

export function MemberRow({ member, isMe }: { member: FamilyMemberDTO; isMe: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Avatar className="size-7">
        {member.image && <AvatarImage src={member.image} alt="" />}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initials(member.name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">
        {member.name ?? 'Участник'}
        {isMe && <span className="font-normal text-muted-foreground"> (вы)</span>}
      </span>
      {member.role === 'owner' ? (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Crown className="size-3.5 text-amber-500" />
          Владелец
        </span>
      ) : (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">Участник</span>
      )}
    </div>
  )
}
